# Documentation of CORS Issue and Troubleshooting for `my-submissions.html`

This document details the attempts to resolve a Cross-Origin Resource Sharing (CORS) error encountered when `my-submissions.html` tried to fetch data from a Google Apps Script web app.

## Initial Problem

The `my-submissions.html` page, hosted on `https://techgeniey.github.io`, was attempting to fetch user-specific data from a Google Apps Script deployed as a web app (e.g., `https://script.google.com/macros/s/.../exec`).

The browser reported the following CORS error:
```
"Access to fetch at 'https://script.google.com/macros/s/AKfycbxWxL3AqKfEMlihocCoKME_4ZFvcvuDS_AoesyIhGzEN8bDyyKucd5fHx_JIVdnpKGUzw/exec?user_id=taejin.yoon%40gmail.com' from origin 'https://techgeniey.github.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource."
```
This error indicates that the response from the Google Apps Script did not include the `Access-Control-Allow-Origin` HTTP header, which is required by browsers to allow cross-origin requests.

## Troubleshooting Attempts and Failures

The primary goal was to modify the `apps-script.js` file to include the necessary CORS headers in the web app's response.

1.  **Attempt 1: Using `.withHeaders()` (Incorrect)**
    *   **Approach:** Initially, I attempted to use a `.withHeaders()` method on the `ContentService.TextOutput` object.
    *   **Failure:** This method does not exist in Google Apps Script for `TextOutput`.

2.  **Attempt 2: Using `.addHeader()` (Incorrect)**
    *   **Approach:** Based on some examples, I then tried using `.addHeader()` on the `ContentService.TextOutput` object.
    *   **Failure:** This method also does not exist for `TextOutput`. The user reported a `TypeError: ...addHeader is not a function`.

3.  **Attempt 3: Using `.setHeader()` (Incorrect for `TextOutput` in this context)**
    *   **Approach:** Further research suggested `.setHeader()` was the correct method. I modified `apps-script.js` to use `.setHeader()` on the `ContentService.TextOutput` object.
    *   **Failure:** The user continued to report a `TypeError: ...setHeader is not a function` from the Apps Script execution logs. This indicated that even though some documentation might show `setHeader`, it was not available or not working as expected in the user's Apps Script environment for `TextOutput`.

4.  **Attempt 4: Using `HtmlService.createHtmlOutput()` and `.addHeader()` (Incorrect)**
    *   **Approach:** Believing that `TextOutput` might be too restrictive, I attempted to switch to `HtmlService.createHtmlOutput()`, set its content, and then use `.addHeader()` on the resulting `HtmlOutput` object. I also added a `doOptions()` function to handle preflight requests.
    *   **Failure:** The user correctly pointed out that `HtmlOutput` also does not have an `addHeader` method. My own subsequent web search confirmed this.

## Conclusion: Google Apps Script Limitation

Through these repeated failures and the user's invaluable corrections, it became clear that **Google Apps Script, when deployed as a web app using `ContentService` or `HtmlService`, does not provide direct programmatic control over HTTP response headers like `Access-Control-Allow-Origin` in the same way a traditional web server does.**

The `TypeError`s encountered were a direct result of attempting to use non-existent methods on the `TextOutput` and `HtmlOutput` objects to manipulate HTTP headers. The client-side CORS error is a consequence of the Apps Script being unable to send the required `Access-Control-Allow-Origin` header.

## Current State of the Project

*   **`apps-script.js`:** The file has been reverted to its original state, removing all the incorrect code related to setting CORS headers. It now only contains the core logic for fetching data and returning a `ContentService.TextOutput`.
*   **`my-submissions.html`:** The `SCRIPT_URL` constant in this file was updated to the user's latest Apps Script deployment URL. This change remains in the file.

## Recommended Solution

To resolve the CORS issue, the most common and effective solution when working with Google Apps Script is to implement a **proxy server**.

The proxy server would:
1.  Receive requests from `https://techgeniey.github.io`.
2.  Forward these requests to the Google Apps Script web app.
3.  Receive the response from the Google Apps Script.
4.  **Add the `Access-Control-Allow-Origin: *` (or a more specific origin like `https://techgeniey.github.io`) header to the response.**
5.  Send the modified response back to `https://techgeniey.github.io`.

This approach allows the client-side application to communicate with the Apps Script while bypassing the direct CORS limitation of the Apps Script environment.
