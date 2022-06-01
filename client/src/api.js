// Wrapper for all API end point calls

function wrapApi()
{
    // The current session CSRF token. (privatized by wrapping in this closure)
    let session_token;

    // Helper to split document tokens to a map
    function cookies()
    {
        return document.cookie.split(';').reduce((cookies, cookie) => {
            const [ name, value ] = cookie.split('=').map(c => c.trim());
            cookies[name] = value;
            return cookies;
        }, {});            
    }

    // Deletes the session CSRF token
    function deleteTokenCookie()
    {
        document.cookie = "msk-session-token= ; expires = Thu, 01 Jan 1970 00:00:00 GMT"
    }

    // Fetch helper
    async function fetchJson(method, endPoint, data)
    {            
        // Setup base options
        let options = {
            method: method,
            credentials: "include",
            cache: "no-cache",
            headers: {}
        }

        // Add data
        if (data)
        {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        // Add CSRF token
        if (session_token)
            options.headers['msk-session-token'] = session_token;

        // Make the request, throw if fails
        let response = await fetch(endPoint, options);
        if (response.status < 200 || response.status > 299)
            throw new Error("Server error:" + response.status);

        // Get the response data
        let rdata = await response.json();

        // If there was a new CSRF token returned, capture it and then delete
        // the cookie.
        let new_token = cookies()['msk-session-token'];
        if (new_token)
        {
            session_token = new_token;
            deleteTokenCookie();
        }

        return rdata;
    }

    // Invokes a POST end point
    async function post(endPoint, data)
    {
        return fetchJson("POST", endPoint, data);
    }

    // Invokes a GET end point
    async function get(endPoint)
    {
        return fetchJson("GET", endPoint);
    }

    // Exports
    return {
        post, 
        get,
    }
}


export default wrapApi();