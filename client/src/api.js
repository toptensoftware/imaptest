// Wrapper for all API end point calls
import useAppState from './AppState';
import Utils from './Utils';
import ReconnectingEventSource from "reconnecting-eventsource";

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

    let events = null;

    function open_events()
    {
        let state = useAppState();
        events = new ReconnectingEventSource('/api/events', { withCredentials: true });

        events.addEventListener('progress', (event) => {
            state.setProgress(JSON.parse(event.data));
        });
    }

    function close_events()
    {
        events?.close();
        events = null;
    }

    // Exports
    return {
        post, 
        get,
        open_events,
        close_events,
    }
}


export default wrapApi();