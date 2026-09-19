import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyD8-3t2_3YwNG39K8XlQoKsCZNTsOBuibw",
    authDomain: "whatsapp-clone-9b0a4.firebaseapp.com",
    projectId: "whatsapp-clone-9b0a4",
    storageBucket: "whatsapp-clone-9b0a4.appspot.com",
    messagingSenderId: "524924699585",
    appId: "1:524924699585:web:44763f53140dc1d15a6540",
    measurementId: "G-8T3CDL8D44"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app, "https://whatsapp-clone-9b0a4-default-rtdb.firebaseio.com/");

// Init EmailJS (v4 safe init)
if (window.emailjs) {
    try {
        emailjs.init({
            publicKey: "IEJI2EB3QbV9m3M8i",
        });
    } catch (e) {
        console.warn("EmailJS Init:", e);
    }
}

// UI Elements
const emailScreen = document.getElementById('emailScreen');
const otpScreen = document.getElementById('otpScreen');
const chatContainer = document.getElementById('chatContainer');

const profileUploadBox = document.getElementById('profileUploadBox');
const avatarFile = document.getElementById('avatarFile');
const previewAvatar = document.getElementById('previewAvatar');

const usernameInput = document.getElementById('usernameInput');
const emailInput = document.getElementById('emailInput');
const sendCodeBtn = document.getElementById('sendCodeBtn');

const otpInput = document.getElementById('otpInput');
const verifyBtn = document.getElementById('verifyBtn');
const otpMsg = document.getElementById('otpMsg');

const userDisplayProfile = document.getElementById('userDisplayProfile');
const chatList = document.getElementById('chatList');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const messageInput = document.getElementById('messageInput');

const backToListBtn = document.getElementById('backToListBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Settings Elements
const openSettingsBtn = document.getElementById('openSettingsBtn');
const settingsScreen = document.getElementById('settingsScreen');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const settingsUsernameInput = document.getElementById('settingsUsernameInput');
const settingsUploadBox = document.getElementById('settingsUploadBox');
const settingsAvatarFile = document.getElementById('settingsAvatarFile');
const settingsPreviewAvatar = document.getElementById('settingsPreviewAvatar');

let generatedCode = '';
let userEmail = '';
let customUsername = '';
let userAvatarUrl = '';
let newAvatarUrl = '';
let selectedChatUser = null;
let unsubscribeMessages = null;
let isSending = false;

// 1. Check Auto-Login Session Persistence on Load
function checkAutoLogin() {
    try {
        const savedSession = localStorage.getItem('whatsapp_session');
        if (savedSession) {
            const userData = JSON.parse(savedSession);
            userEmail = userData.email;
            customUsername = userData.name;
            userAvatarUrl = userData.avatar;

            if (emailScreen) emailScreen.style.display = 'none';
            if (otpScreen) otpScreen.style.display = 'none';
            if (chatContainer) chatContainer.style.display = 'flex';

            if (userDisplayProfile) userDisplayProfile.textContent = customUsername;
            const myAvatar = document.getElementById('myAvatar');
            if (myAvatar && userAvatarUrl) myAvatar.src = userAvatarUrl;

            registerUserInDatabase(true);
            loadInboxUsers();

            window.addEventListener('beforeunload', () => {
                registerUserInDatabase(false);
            });
        }
    } catch (err) {
        console.error("Auto login error:", err);
    }
}
checkAutoLogin();

// 2. Profile Photo Upload Handler (Login)
if (profileUploadBox && avatarFile) {
    profileUploadBox.addEventListener('click', () => avatarFile.click());

    avatarFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                userAvatarUrl = event.target.result;
                if (previewAvatar) {
                    previewAvatar.src = userAvatarUrl;
                    previewAvatar.style.display = 'block';
                }
                const uploadSpan = profileUploadBox.querySelector('span');
                if (uploadSpan) uploadSpan.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });
}

// 3. Settings Modal Functionality
if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
        if (settingsUsernameInput) settingsUsernameInput.value = customUsername;
        if (settingsPreviewAvatar) settingsPreviewAvatar.src = userAvatarUrl;
        newAvatarUrl = userAvatarUrl;
        if (settingsScreen) settingsScreen.style.display = 'flex';
    });
}

if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
        if (settingsScreen) settingsScreen.style.display = 'none';
    });
}

if (settingsUploadBox && settingsAvatarFile) {
    settingsUploadBox.addEventListener('click', () => settingsAvatarFile.click());

    settingsAvatarFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                newAvatarUrl = event.target.result;
                if (settingsPreviewAvatar) settingsPreviewAvatar.src = newAvatarUrl;
            };
            reader.readAsDataURL(file);
        }
    });
}

if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        const updatedName = settingsUsernameInput ? settingsUsernameInput.value.trim() : '';
        if (!updatedName) {
            alert('Name cannot be empty!');
            return;
        }

        customUsername = updatedName;
        userAvatarUrl = newAvatarUrl;

        if (userDisplayProfile) userDisplayProfile.textContent = customUsername;
        const myAvatar = document.getElementById('myAvatar');
        if (myAvatar) myAvatar.src = userAvatarUrl;

        localStorage.setItem('whatsapp_session', JSON.stringify({
            email: userEmail,
            name: customUsername,
            avatar: userAvatarUrl
        }));

        registerUserInDatabase(true);
        if (settingsScreen) settingsScreen.style.display = 'none';
        alert('Profile updated successfully!');
    });
}

// 4. Step 1: Send OTP via EmailJS
if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', async () => {
        customUsername = usernameInput ? usernameInput.value.trim() : '';
        userEmail = emailInput ? emailInput.value.trim() : '';

        if (!customUsername) {
            alert('Please enter a username!');
            return;
        }
        if (!userEmail || !userEmail.includes('@')) {
            alert('Please enter a valid Gmail address!');
            return;
        }

        sendCodeBtn.textContent = 'Sending code...';
        sendCodeBtn.disabled = true;

        generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
        const timeNow = new Date().toLocaleTimeString();

        const templateParams = {
            to_email: userEmail,
            passcode: generatedCode,
            name: customUsername,
            time: timeNow,
            email: userEmail
        };

        try {
            await emailjs.send('service_de1q51q', 'template_vgdiw1p', templateParams);
            alert(`Verification code successfully sent to ${userEmail}!`);
        } catch (err) {
            console.error("EmailJS Error:", err);
            alert(`Failed to send email via service.\nYour verification code is: ${generatedCode}`);
        } finally {
            if (emailScreen) emailScreen.style.display = 'none';
            if (otpScreen) otpScreen.style.display = 'flex';
            if (otpMsg) otpMsg.textContent = `Enter the 4-digit verification code sent to ${userEmail}`;
            sendCodeBtn.textContent = 'Get Verification Code';
            sendCodeBtn.disabled = false;
        }
    });
}

// 5. Step 2: OTP Verification & Auto-Save Session
if (verifyBtn) {
    verifyBtn.addEventListener('click', () => {
        const enteredCode = otpInput ? otpInput.value.trim() : '';

        if (!enteredCode) {
            alert('Please enter the verification code!');
            return;
        }

        if (enteredCode === generatedCode) {
            if (otpScreen) otpScreen.style.display = 'none';
            if (chatContainer) chatContainer.style.display = 'flex';

            if (!userAvatarUrl) {
                userAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${customUsername}`;
            }

            if (userDisplayProfile) userDisplayProfile.textContent = customUsername;
            const myAvatar = document.getElementById('myAvatar');
            if (myAvatar) myAvatar.src = userAvatarUrl;

            localStorage.setItem('whatsapp_session', JSON.stringify({
                email: userEmail,
                name: customUsername,
                avatar: userAvatarUrl
            }));

            registerUserInDatabase(true);
            loadInboxUsers();

            window.addEventListener('beforeunload', () => {
                registerUserInDatabase(false);
            });
        } else {
            alert('Invalid verification code! Please check and try again.');
        }
    });
}

// 6. Logout Feature
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to log out?')) {
            registerUserInDatabase(false);
            localStorage.removeItem('whatsapp_session');
            location.reload();
        }
    });
}

// 7. Mobile Navigation (Back Button)
if (backToListBtn) {
    backToListBtn.addEventListener('click', () => {
        if (chatContainer) chatContainer.classList.remove('show-chat');
    });
}

// 8. Save User Status in Firebase DB
function registerUserInDatabase(isOnline) {
    if (!userEmail) return;
    const userSafeKey = userEmail.replace(/[.#$[\]]/g, '_');
    const userRef = ref(db, `users/${userSafeKey}`);
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    set(userRef, {
        name: customUsername,
        email: userEmail,
        avatar: userAvatarUrl,
        online: isOnline,
        lastSeen: `Last seen today at ${timeNow}`
    }).catch(err => console.error("Database user reg error:", err));
}

// 9. Load Users & Mobile View Switcher
function loadInboxUsers() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        if (!chatList) return;
        chatList.innerHTML = '';
        const users = snapshot.val();
        if (!users) return;

        Object.values(users).forEach((u) => {
            if (u.email === userEmail) return;

            const chatItem = document.createElement('div');
            chatItem.classList.add('chat-item');
            chatItem.innerHTML = `
                <img src="${u.avatar || 'https://i.pravatar.cc/150'}" class="chat-avatar" alt="Avatar">
                <div class="chat-info">
                    <div style="display: flex; justify-content: space-between;">
                        <h5>${u.name}</h5>
                        <span style="font-size: 11px; color: ${u.online ? '#00ffcc' : '#8696a0'};">${u.online ? 'online' : 'offline'}</span>
                    </div>
                    <p>${u.online ? 'Tap to chat' : u.lastSeen}</p>
                </div>
            `;

            chatItem.addEventListener('click', () => {
                selectedChatUser = u;
                document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
                chatItem.classList.add('active');

                if (chatContainer) chatContainer.classList.add('show-chat');

                const activeChatName = document.getElementById('activeChatName');
                const activeChatAvatar = document.getElementById('activeChatAvatar');
                if (activeChatName) activeChatName.textContent = u.name;
                if (activeChatAvatar) activeChatAvatar.src = u.avatar;
                
                const activeChatStatus = document.getElementById('activeChatStatus');
                if (activeChatStatus) {
                    activeChatStatus.innerHTML = `${u.online ? 'Online' : u.lastSeen} <span class="online-dot ${u.online ? '' : 'offline'}"></span>`;
                }

                loadPrivateMessages();
            });

            chatList.appendChild(chatItem);
        });
    });
}

// 10. Realtime 1-on-1 Messages Stream
function loadPrivateMessages() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    if (chatMessages) chatMessages.innerHTML = '';

    const messagesRef = ref(db, 'messages');
    unsubscribeMessages = onValue(messagesRef, (snapshot) => {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        const messages = snapshot.val();
        if (!messages || !selectedChatUser) return;

        Object.keys(messages).forEach((msgKey) => {
            const msgData = messages[msgKey];

            const isThemMsgToMe = (msgData.senderEmail === selectedChatUser.email && msgData.receiverEmail === userEmail);
            const isMyMsgToThem = (msgData.senderEmail === userEmail && msgData.receiverEmail === selectedChatUser.email);

            if (isMyMsgToThem || isThemMsgToMe) {
                if (isThemMsgToMe && msgData.status !== 'read' && !msgData.deleted) {
                    update(ref(db, `messages/${msgKey}`), { status: 'read' });
                }

                appendMessageToUI(msgData, msgKey);
            }
        });
    });
}

// 11. Send Message Handling
if (sendBtn) {
    sendBtn.onclick = function(e) {
        sendPrivateMessage(e);
    };
}

if (messageInput) {
    messageInput.onkeydown = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPrivateMessage(e);
        }
    };
}

function sendPrivateMessage(e) {
    if (e) e.preventDefault();
    
    if (!messageInput) return;
    const text = messageInput.value.trim();
    if (!text) return;
    if (!selectedChatUser) {
        alert('Please select a contact to start messaging!');
        return;
    }

    if (isSending) return;
    isSending = true;

    messageInput.value = '';

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messagesRef = ref(db, 'messages');

    push(messagesRef, {
        senderEmail: userEmail,
        receiverEmail: selectedChatUser.email,
        senderName: customUsername,
        text: text,
        time: timeNow,
        status: 'sent',
        deleted: false
    }).then(() => {
        isSending = false;
    }).catch(() => {
        isSending = false;
    });
}

// 12. Render Message with Delete & Correct Side Alignment
function appendMessageToUI(data, msgKey) {
    if (!chatMessages) return;
    if (document.getElementById(`msg-${msgKey}`)) {
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.id = `msg-${msgKey}`;
    
    const isSentByMe = data.senderEmail === userEmail;
    
    messageDiv.classList.add('message', isSentByMe ? 'sent' : 'received');

    if (data.deleted) {
        messageDiv.classList.add('deleted-message');
        messageDiv.innerHTML = `
            <p><i>🚫 This message was deleted</i></p>
            <div class="message-meta">
                <span class="time">${data.time}</span>
            </div>
        `;
    } else {
        const isRead = data.status === 'read';
        const tickHTML = isSentByMe ? `<i class="fas fa-check-double tick-icon ${isRead ? 'read' : ''}"></i>` : '';
        const deleteBtnHTML = isSentByMe ? `<i class="fas fa-trash msg-delete-btn" title="Delete for everyone"></i>` : '';

        messageDiv.innerHTML = `
            <div class="msg-content-wrapper">
                <p>${data.text}</p>
                ${deleteBtnHTML}
            </div>
            <div class="message-meta">
                <span class="time">${data.time}</span>
                ${tickHTML}
            </div>
        `;

        if (isSentByMe) {
            const trashBtn = messageDiv.querySelector('.msg-delete-btn');
            if (trashBtn) {
                trashBtn.addEventListener('click', () => {
                    if (confirm('Delete this message for everyone?')) {
                        update(ref(db, `messages/${msgKey}`), {
                            deleted: true,
                            text: '🚫 This message was deleted'
                        });
                    }
                });
            }
        }
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}