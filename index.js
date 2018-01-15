import RequestPromise from 'request-promise';
import sanitizer from 'sanitize-filename';
import decode from 'unescape';
import { AllHtmlEntities as HtmlParser } from 'html-entities';

const htmlparser = new HtmlParser();

let request = RequestPromise.defaults({ jar: true });
let headers = {
    'Accept': 'application/json, text/plain, *.*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'user-agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36',
    'Referer': 'https://globallogic.udemy.com/organization/login/'
};
const loginGet = "https://globallogic.udemy.com/organization/login/";
const loginPost = "https://globallogic.udemy.com/join/login-popup/";
const logout_url = 'https://globallogic.udemy.com/user/logout';
const course_list = 'https://globallogic.udemy.com/api-2.0/courses/?page_size=10000';
const course_details = 'https://globallogic.udemy.com/api-2.0/courses/{course_id}/cached-subscriber-curriculum-items?fields[asset]=results,external_url,download_urls,slide_urls,filename,asset_type&fields[chapter]=object_index,title,sort_order&fields[lecture]=id,title,object_index,asset,supplementary_assets,view_html,sort_order&page_size=100000';
const get_url = 'https://globallogic.udemy.com/api-2.0/users/me/subscribed-courses/{course_id}/lectures/{lecture_id}?fields[lecture]=view_html,asset';
const attached_file_url = 'https://globallogic.udemy.com/api-2.0/users/me/subscribed-courses/{course_id}/lectures/{lecture_id}/supplementary-assets/{asset_id}?fields[asset]=download_urls';
const num_lectures = 'https://globallogic.udemy.com/api-2.0/courses/{course_id}?fields[course]=num_lectures';
const regexCsrf = /csrftoken=([\S]*);/
const regexClientId = /client_id=([\S]*);/
const regexAccessToken = /access_token=([\S]*);/
const regexCourseId = /&quot;id&quot;:\s(.*?),/
const regexTracks = /text-tracks="(\[.+?\])/
const regexVideoSrc = /"sources":(\[.+?\])/

async function main() {
    const course_url = 'https://globallogic.udemy.com/ethereum-masterclass/learn/v4/overview'//args[0];
    fiddlerProxyOn();
    //fiddlerProxyOff();

    let csrfToken, ClientId, AccessToken, courseId,
        email = "udita.verma@globallogic.com",
        password = "abc@123";
    const loginGetResp = await request({ url: loginGet, headers: headers, resolveWithFullResponse: true });
    if (loginGetResp.statusCode == 200) {
        loginGetResp.headers['set-cookie'].forEach((value, name) => {
            if (regexCsrf.test(value)) {
                const match = regexCsrf.exec(value);
                console.log('csrftoken => ', match[1]);
                csrfToken = match[1];
            }
        });
    }
    if (csrfToken) {
        var formData = {
            csrfmiddlewaretoken: csrfToken,
            email: email,
            password: password
        };
        const loginPostResp = await request.post({
            method: 'POST',
            headers: headers,
            url: loginPost,
            formData: formData,
            forever: true,
            resolveWithFullResponse: true
        });
        if (loginPostResp.statusCode == 200) {
            loginPostResp.headers['set-cookie'].forEach((value, name) => {
                if (regexClientId.test(value)) {
                    const match = regexClientId.exec(value);
                    console.log('ClientId => ', match[1]);
                    ClientId = match[1];
                }
                if (regexAccessToken.test(value)) {
                    const match = regexAccessToken.exec(value);
                    console.log('AccessToken => ', match[1]);
                    AccessToken = match[1];
                    headers['Authorization'] = `Bearer ${AccessToken}`;
                    headers['X-Udemy-Authorization'] = `Bearer ${AccessToken}`;
                }
            });
            // actuall downlaoding

            //getCourseId 
            const courseResp = await request({
                url: course_url,
                headers: Object.assign({}, headers,
                    {
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
                    }),
                gzip: true,
                encoding: 'utf8',
                resolveWithFullResponse: true
            });
            if (courseResp.statusCode == 200) {
                const body = courseResp.body;
                if (regexCourseId.test(body)) {
                    courseId = regexCourseId.exec(body)[1];
                }
                console.log(`CourseId => ${courseId}`);
            }
            if (courseId) {
                //no of lectures in course
                let lectureCountUrl = num_lectures.replace('{course_id}', courseId);
                const lecture = await request({
                    url: lectureCountUrl,
                    headers: headers,
                    gzip: true,
                    json: true
                });
                if (lecture && lecture.id == courseId) {
                    console.log(`No of lectures: ${lecture.num_lectures}`);
                }

                //Course Details 

                let courseDetailsUrl = course_details.replace('{course_id}', courseId);
                const courseDetails = await request({
                    url: courseDetailsUrl,
                    headers: headers,
                    gzip: true,
                    json: true
                });
                if (courseDetails) {
                    const lectureCount = courseDetails.results.filter(x => x._class == 'lecture' && x.asset.asset_type == "Video").length;
                    console.log(`Course Details: ${JSON.stringify(courseDetails)}`);
                }
            }
        }
    }
}

function fiddlerProxyOn() {
    var proxyUrl = "http://127.0.0.1:8888";
    process.env.HTTP_PROXY = proxyUrl;
    process.env.HTTPS_PROXY = proxyUrl;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
}

function fiddlerProxyOff() {
    process.env.HTTP_PROXY = "";
    process.env.HTTPS_PROXY = "";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "";
}
function main2() {
    const courseData = require('./data.json');
    const udemy_dict = {};
    courseData.results.forEach(x => {
        if (x._class == "lecture") {
            const chapter_number = x.object_index;
            const chapter = sanitizer(x.title).replace(/\s/g, "_");
            const chap = `${chapter_number} ${chapter}`;
            udemy_dict[chap] = {};
            const { id: lecture_id, asset, supplementary_assets, view_html } = x;
            if (asset.asset_type == "Video") {
                const decodedUnescapedHtml = decode(htmlparser.decode(view_html));
                const VideoSrc = `"${regexVideoSrc.exec(decodedUnescapedHtml)[1]}"`;
                const textSrc = regexTracks.exec(decodedUnescapedHtml)[1];
                console.log(VideoSrc);
                
                const videoJSON = JSON.parse(VideoSrc);
                // const tracksJSON = JSON.parse(textSrc);                
            }
            udemy_dict[chap] = {
                lecture_id,
            };
        }
        if (x._class == "chapter") {
            const chapter_number = x.object_index;
            const chapter = sanitizer(x.title).replace(/\s/g, "_");
            const chap = `${chapter_number} ${chapter}`;
            udemy_dict[chap] = {};
        }
    })    
}
main2();