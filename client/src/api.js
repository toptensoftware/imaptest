// Wrapper for all API end point calls
import useAppState from './AppState';
import Utils from './Utils';

function wrapApi()
{
    function setCsrfToken(token)
    {
        if (token == null)
            localStorage.removeItem("x-csrf-token");
        else
            localStorage.setItem("x-csrf-token", token);
    }

    function getCsrfToken()
    {
        return localStorage.getItem("x-csrf-token")
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
        let csrf_token = getCsrfToken();
        if (csrf_token)
            options.headers['x-csrf-token'] = csrf_token;

            // Make the request, throw if fails
        let response = await fetch(endPoint, options);
        if (response.status < 200 || response.status > 299)
        {
            if (response.status == 401)
            {
                let state = useAppState();
                state.authError();
            }

            throw new Error("Server error:" + response.status);
        }

        // Get the response data
        let rdata = await response.json();

        // Catch new csrf token
        for (let [k,v] of response.headers)
        {
            if (k == "x-csrf-token")
                setCsrfToken(v);
        }

        return rdata;
    }

    // Invokes a POST end point
    async function post(endPoint, data)
    {
        return fetchJson("POST", endPoint, data);
    }

    // Invokes a GET end point
    async function get(endPoint, query)
    {
        return fetchJson("GET", endPoint + Utils.queryString(query));
    }

    async function monitor_sync_progress()
    {
        // Setup base options
        let options = {
            method: "GET",
            credentials: "include",
            cache: "no-cache",
            headers: {}
        }

        // Add CSRF token
        let csrf_token = getCsrfToken();
        if (csrf_token)
            options.headers['x-csrf-token'] = csrf_token;

        // Make the request, throw if fails
        let response = await fetch('/api/sync_progress', options);
        if (response.status < 200 || response.status > 299)
        {
            if (response.status == 401)
            {
                let state = useAppState();
                state.authError();
            }

            throw new Error("Server error:" + response.status);
        }

        // Catch new csrf token
        for (let [k,v] of response.headers)
        {
            if (k == "x-csrf-token")
                setCsrfToken(v);
        }

        let state = useAppState();

        // Get the reader
        let reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = ""
        while (true)
        {
            let { done, value } = await reader.read();
            if (done)
                break;

            console.log(">>", value);

            buf += value;

            while (true)
            {
                let linePos = buf.indexOf('\n');
                if (linePos >= 0)
                {
                    let line = buf.substring(0, linePos);
                    buf = buf.substring(linePos+1);

                    let spacePos = line.indexOf(' ');
                    if (spacePos >= 0)
                    {
                        state.setProgress(parseInt(line.substring(0, spacePos)), line.substring(spacePos+1));
                    }
                }
                else
                    break;
            }

        }

        // Done

    }

    // Exports
    return {
        post, 
        get,
        monitor_sync_progress,
    }
}


export default wrapApi();