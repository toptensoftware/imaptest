function wrapApi()
{
    let session_token;

    function cookies()
    {
        return document.cookie.split(';').reduce((cookies, cookie) => {
            const [ name, value ] = cookie.split('=').map(c => c.trim());
            cookies[name] = value;
            return cookies;
        }, {});            
    }

    function deleteTokenCookie()
    {
        document.cookie = "msk-session-token= ; expires = Thu, 01 Jan 1970 00:00:00 GMT"
    }

    async function fetchJson(method, endPoint, data)
    {            
        let options = {
            method: method,
            credentials: "include",
            cache: "no-cache",
            body: JSON.stringify(data),
            headers: {}
        }
        if (method == 'POST')
            options.headers['Content-Type'] = 'application/json';

        if (session_token)
            options.headers['msk-session-token'] = session_token;

        let response = await fetch("http://localhost:4000" + endPoint, options);
        if (response.status < 200 || response.status > 299)
            throw new Error("Server error:" + response.status);

        let rdata = await response.json();

        let new_token = cookies()['msk-session-token'];
        if (new_token)
        {
            session_token = new_token;
            deleteTokenCookie();
        }

        return rdata;
    }

    async function post(endPoint, data)
    {
        return fetchJson("POST", endPoint, data);
    }

    async function get(endPoint)
    {
        return fetchJson("GET", endPoint);
    }

    return {
        post, 
        get,
    }
}


export default wrapApi();