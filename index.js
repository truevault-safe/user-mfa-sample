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

const createUserTvClient = new TrueVaultClient(TV_CREDENTIALS.CREATE_USER_API_KEY);
let tvUser;
let tvUserClient;
let tasksDocumentId;
let tasks = [];

async function loginUser(username, password, mfaCode){
    tvUserClient = await TrueVaultClient.login(TV_CREDENTIALS.ACCOUNT_ID, username, password, mfaCode);
    tvUser = await tvUserClient.readCurrentUser();
}

async function registerUser(username, password) {
    tvUser = await createUserTvClient.createUser(username, password);
    await createUserTvClient.addUsersToGroup(TV_CREDENTIALS.GROUP_ID, [tvUser.id]);
    tvUserClient = new TrueVaultClient(tvUser.access_token);
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

authFormEl.addEventListener("submit", async e => {
    e.preventDefault();

    authValidationErrorEl.style.display = 'none';

    let authPromise;

    if (location.hash === '#sign_up') {
        authPromise = registerUser(this.username.value, this.password.value);
    } else {
        authPromise = loginUser(this.username.value, this.password.value, this.mfa_code.value);
    }

    try {
        await authPromise;
        location.hash = '#tasks';
    } catch (error) {
        authValidationErrorEl.style.display = '';
        authValidationErrorEl.textContent = error.message;
        if (error.error.type === 'USER.MFA_CODE_REQUIRED') {
            mfaCodeRowEl.style.display = '';
        }
    }
});

unenrollMFAFormEl.addEventListener("submit", async e => {
    e.preventDefault();

    try {
        await tvUserClient.unenrollMfa(tvUser.id, this.unenroll_mfa_code.value, this.unenroll_mfa_password.value);
        tvUser.mfa_enrolled = false;
        refreshState();
    } catch (error) {
        alert(error.message);
    }
});

async function refreshTasks() {
    try {
        const listDocsResponse = await tvUserClient.listDocuments(TV_CREDENTIALS.VAULT_ID, true);
        if (listDocsResponse.items.length > 0) {
            const item = listDocsResponse.items[0];
            tasksDocumentId = item.id;
            tasks = item.document;
        } else {
            const createDocResponse = await tvUserClient.createDocument(TV_CREDENTIALS.VAULT_ID, null, [], tvUser.id);
            tasksDocumentId = createDocResponse.document_id;
            tasks = [];
        }
        displayTasks();
    } catch (error) {
        alert(error.message);
    }
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
    return tvUserClient.updateDocument(TV_CREDENTIALS.VAULT_ID, tasksDocumentId, tasks);
}

document.getElementById("add-task-form").addEventListener('submit', e => {
    e.preventDefault();

    tasks.unshift({task: this.task.value, completed: false});

    this.task.value = "";

    saveTasks();

    displayTasks();
});

document.getElementById("start-mfa").addEventListener('click', async e => {
    e.preventDefault();

    try {
        const response = await tvUserClient.startUserMfaEnrollment(tvUser.id, 'True Do');
        userSettingsFormEl.style.display = '';
        document.getElementById('mfa-qr-code').src = `data:image/svg+xml;base64,${btoa(response.mfa.qr_code_svg)}`;
    } catch (error) {
        alert(error.message)
    }
});

userSettingsFormEl.addEventListener('submit', async e => {
    e.preventDefault();

    try {
        await tvUserClient.finalizeMfaEnrollment(tvUser.id, this.mfa_code_1.value, this.mfa_code_2.value);
        tvUser.mfa_enrolled = true;
        refreshState();
    } catch (error) {
        alert(error.message);
    }
});

window.onpopstate = () => setState(location.hash);

function refreshState() {
    setState(location.hash);
}

refreshState();
