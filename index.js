const authValidationErrorEl = document.getElementById("auth-validation-error");
const authFormEl = document.getElementById("auth-form");
const loggedInPageEl = document.getElementById("logged-in");
const authSubmitButton = document.getElementById("auth-submit");
const tasksTableBodyEl = document.getElementById("tasks-table-body");
const otherAuthLinkEl = document.getElementById("other-auth-link");
const userSettingsFormEl = document.getElementById("user-settings-form");
const links = document.querySelectorAll('.nav a');
const authLinks = document.querySelectorAll('.auth-link');
const unauthLinks = document.querySelectorAll('.unauth-link');
const mfaCodeRowEl = document.getElementById("mfa-code-row");
const unenrollMFAFormEl = document.getElementById("unenroll-mfa-form");
const startMFAEl = document.getElementById("start-mfa");

let tvUser = null;
let tasksDocumentId = null;
let tasks = [];

function registerUser(username, password) {
    return createUser(TV_CREDENTIALS.CREATE_USER_API_KEY, username, password)
        .then(function (response) {
            return addUserToGroup(TV_CREDENTIALS.CREATE_USER_API_KEY, response.user.id, TV_CREDENTIALS.GROUP_ID).then(() => response);
        });
}

function setState(newState) {
    authFormEl.style.display = 'none';
    loggedInPageEl.style.display = 'none';
    userSettingsFormEl.style.display = 'none';
    mfaCodeRowEl.style.display = 'none';
    unenrollMFAFormEl.style.display = 'none';
    startMFAEl.style.display = 'none';

    links.forEach(link => link.style.display = 'none');

    const linksToShow = tvUser ? authLinks : unauthLinks;
    linksToShow.forEach(link => link.style.display = '');

    switch (newState) {
        case '#sign_up':
            authFormEl.style.display = '';
            authSubmitButton.textContent = 'Sign Up';

            otherAuthLinkEl.href = '#sign_in';
            otherAuthLinkEl.textContent = 'Sign In';
            break;
        case '#tasks':
        default:
            if (!tvUser) {
                location.hash = '#sign_in';
                return;
            }
            loggedInPageEl.style.display = '';
            refreshTasks();
            break;
        case '#user_settings':
            if (!tvUser) {
                location.hash = '#sign_in';
                return;
            }

            if (tvUser.mfa_enrolled) {
                unenrollMFAFormEl.style.display = '';
            } else {
                startMFAEl.style.display = '';
            }

            break;
        case '#sign_in':
            authFormEl.style.display = '';
            authSubmitButton.textContent = 'Sign In';

            otherAuthLinkEl.href = '#sign_up';
            otherAuthLinkEl.textContent = 'Sign Up';
            break;
    }
}

authFormEl.addEventListener("submit", e => {
    e.preventDefault();

    authValidationErrorEl.style.display = 'none';

    let authPromise;

    if (location.hash === '#sign_up') {
        authPromise = registerUser(this.username.value, this.password.value);
    } else {
        authPromise = loginUser(this.username.value, this.password.value, this.mfa_code.value);
    }

    authPromise
        .then(response => {
            tvUser = response.user;
            location.hash = '#tasks';
        })
        .catch(error => {
            authValidationErrorEl.style.display = '';
            authValidationErrorEl.textContent = error.message;

            if (error.response.error.type === 'USER.MFA_CODE_REQUIRED') {
                mfaCodeRowEl.style.display = '';
            }
        });
});

unenrollMFAFormEl.addEventListener("submit", e => {
    e.preventDefault();

    unenrollMFA(tvUser.access_token, tvUser.id, this.unenroll_mfa_code.value, this.unenroll_mfa_password.value)
        .then(() => {
            tvUser.mfa_enrolled = false;
            refreshState();
        })
        .catch(error => {
            alert(error.message);
        });
});

function refreshTasks() {
    getDocuments(tvUser.access_token, TV_CREDENTIALS.VAULT_ID)
        .then(response => {
            if (response.data.items.length > 0) {
                const item = response.data.items[0];
                return {
                    id: item.id,
                    doc: JSON.parse(atob(item.document))
                };
            } else {
                return createDocument(tvUser.access_token, TV_CREDENTIALS.VAULT_ID, tvUser.id, [])
                    .then(response => ({
                        id: response.document_id,
                        doc: []
                    }));
            }
        })
        .then(t => {
            tasksDocumentId = t.id;
            tasks = t.doc;
            displayTasks();
        })
        .catch(error => alert(error.message));
}

function displayTasks() {
    tasksTableBodyEl.innerHTML = tasks.map((task, idx) => `
    <tr>
      <td><input type="checkbox" data-task-index="${idx}" ${task.completed ? 'checked' : ''}></td>
      <td>${task.task}</td>
    </tr>
    `).join('');
}

tasksTableBodyEl.addEventListener('click', e => {
    // Navigate upwards from the target element to find the clicked row
    let rowElement = e.target;
    while (rowElement.parentElement !== tasksTableBodyEl) {
        rowElement = rowElement.parentElement;
    }

    const checkbox = rowElement.querySelector('input');
    tasks[checkbox.dataset.taskIndex].completed = checkbox.checked;

    saveTasks();
});

function saveTasks() {
    return updateDocument(tvUser.access_token, TV_CREDENTIALS.VAULT_ID, tasksDocumentId, tasks);
}

document.getElementById("add-task-form").addEventListener('submit', e => {
    e.preventDefault();

    tasks.unshift({task: this.task.value, completed: false});

    this.task.value = "";

    saveTasks();

    displayTasks();
});

document.getElementById("start-mfa").addEventListener('click', e => {
    e.preventDefault();

    startUserMFAEnrollment(tvUser.access_token, tvUser.id)
        .then(response => {
            userSettingsFormEl.style.display = '';
            document.getElementById('mfa-qr-code').src = `data:image/svg+xml;base64,${btoa(response.mfa.qr_code_svg)}`;
        })
        .catch(e => alert(e.message));
});

userSettingsFormEl.addEventListener('submit', e => {
    e.preventDefault();

    finalizeMFAEnrollment(tvUser.access_token, tvUser.id, this.mfa_code_1.value, this.mfa_code_2.value)
        .then(() => {
            tvUser.mfa_enrolled = true;
            refreshState();
        })
        .catch(e => alert(e.message));
});

window.onpopstate = () => setState(location.hash);

function refreshState() {
    setState(location.hash);
}

refreshState();
