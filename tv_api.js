function tvRequest(auth, method, path, formParams, structureToJson) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.responseType = 'json';

        xhr.open(method, `https://api.truevault.com/v1/${path}`);

        if (auth) {
            xhr.setRequestHeader("Authorization", 'Basic ' + btoa(`${auth}:`));
        }

        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(xhr.response);
            } else {
                let error = new Error(xhr.response.error.message);
                error.response = xhr.response;
                reject(error);
            }
        };

        xhr.onerror = () => {
            reject(new Error("Unable to connect"));
        };

        let requestBody;
        if (formParams) {
            requestBody = new FormData();
            for (let key in formParams) {
                if (formParams.hasOwnProperty(key)) {
                    requestBody.append(key, formParams[key]);
                }
            }
        } else if (structureToJson) {
            requestBody = JSON.stringify(structureToJson)
            xhr.setRequestHeader("Content-Type", "application/json")
        }
        xhr.send(requestBody);
    });
}

function loginUser(username, password) {
    return tvRequest(null, "POST", "auth/login", {
        account_id: TV_CREDENTIALS.ACCOUNT_ID,
        username: username,
        password: password
    });
}

function createUser(apiKey, username, password) {
    return tvRequest(apiKey, "POST", "users", {
        username: username,
        password: password
    });
}

function addUserToGroup(apiKey, userId, groupId) {
    return tvRequest(apiKey, "POST", `groups/${groupId}/membership`, null, {
        user_ids: [userId]
    });
}

function getDocuments(accessToken, vaultId) {
    return tvRequest(accessToken, "GET", `vaults/${vaultId}/documents?full=true`, null);
}

function createDocument(accessToken, vaultId, ownerId, doc) {
    return tvRequest(accessToken, "POST", `vaults/${vaultId}/documents`, {
        owner_id: ownerId,
        document: btoa(JSON.stringify(doc))
    });
}

function updateDocument(accessToken, vaultId, docId, doc) {
    return tvRequest(accessToken, "PUT", `vaults/${vaultId}/documents/${docId}`, {
        document: btoa(JSON.stringify(doc))
    });
}
