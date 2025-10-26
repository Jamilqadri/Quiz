// script.js - (MODIFIED VERSION)

// --- CONFIGURATION ---
// REPLACE THIS WITH YOUR ACTUAL GOOGLE APPS SCRIPT URL
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwEDpBqpPoIWceuNEhLFy3aQ9Q6WuL4N8W9JY-E-naXwl3M0rJVIWqq8rJCemmJcP9O/exec'; 
const QUIZ_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours lock in milliseconds (MODIFIED)
const MAX_TIME_PER_QUESTION = 20; // Seconds
const CORRECT_SCORE = 20; // Base score per question
const PENALTY_START_TIME = 10; // Penalty starts after 10 seconds (time taken)
const PENALTY_PER_SECOND = 2; // 2 points deduction per second after 10s
const NUM_QUESTIONS = 10; // Number of questions per quiz (MODIFIED)
const QUIZ_TOTAL_SCORE = NUM_QUESTIONS * CORRECT_SCORE; // 200

// ... (INDIAN_STATES array remains the same) ...
const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", 
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", 
    "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", 
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", 
    "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", 
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

class Quiz {
    constructor() {
        this.currentQuestionIndex = 0;
        this.finalScore = 0;
        this.randomQuestions = []; 
        this.answers = []; 
        this.userInfo = { name: '', contact: '', address: '', state: '' };
        this.timer = null;
        this.timeLeft = MAX_TIME_PER_QUESTION;
        this.timeTaken = 0;
        this.hasAnswered = false; 
        this.lockTimer = null; 
    }

    init() {
        this.populateStates();
        this.setupEventListeners();
        this.checkQuizLock();

        // Check for required number of questions (2000 minimum suggested, but logic checks for NUM_QUESTIONS)
        if (!window.quizQuestions || !Array.isArray(window.quizQuestions) || window.quizQuestions.length < NUM_QUESTIONS) {
            document.getElementById('startQuiz').disabled = true;
            document.getElementById('noticeText').textContent = '⚠️ اہم غلطی: سوالات کی مطلوبہ تعداد لوڈ نہیں ہوئی۔ براہ کرم questions.js فائل چیک کریں۔';
            document.getElementById('dailyNotice').style.display = 'block';
        }
        // Fetch leaderboard immediately
        this.fetchLeaderboard('welcomeLeaderboard'); 
    }

    // --- UI/Screen Management & Setup (MODIFIED) ---

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    populateStates() {
        const stateSelect = document.getElementById('state');
        INDIAN_STATES.forEach(state => {
            const option = document.createElement('option');
            option.value = state; 
            option.textContent = state;
            stateSelect.appendChild(option);
        });
    }

    setupEventListeners() {
        document.getElementById('startQuiz').addEventListener('click', () => {
            this.startQuiz();
        });
        document.getElementById('userInfoForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.collectUserInfoAndSave(); // Saves data silently then shows results
        });
        document.getElementById('nextQuestion').addEventListener('click', () => {
            this.nextQuestion();
        });
        document.getElementById('playAgain').addEventListener('click', () => {
            this.showScreen('welcomeScreen');
            this.checkQuizLock(); 
        });

        // New Event Listeners for Icons
        document.getElementById('openTimerRules').addEventListener('click', () => {
            this.showScreen('rulesScreen');
        });
        document.getElementById('openScoreHistory').addEventListener('click', () => {
            this.showScreen('historyScreen');
            this.fetchUserHistory('userHistoryList'); // Fetch and display user history
        });
        document.getElementById('openLeaderboard').addEventListener('click', () => {
            // Already shows on welcome screen, but can be a quick refresh/navigation
            this.showScreen('welcomeScreen');
            this.fetchLeaderboard('welcomeLeaderboard'); 
        });
        document.querySelectorAll('.close-screen').forEach(button => {
            button.addEventListener('click', (e) => {
                this.showScreen(e.target.dataset.target);
            });
        });
    }

    // --- QUIZ LOCK/COUNTDOWN LOGIC (5 Hours) (MODIFIED) ---

    checkQuizLock() {
        const lastPlayed = localStorage.getItem('lastPlayedTimestamp');
        const now = new Date().getTime();
        const startQuizBtn = document.getElementById('startQuiz');
        const dailyNotice = document.getElementById('dailyNotice');
        const countdownTimer = document.getElementById('countdownTimer');

        const initialNoticeText = document.getElementById('noticeText').textContent;

        if (lastPlayed) {
            const timeElapsed = now - parseInt(lastPlayed);

            if (timeElapsed < QUIZ_DURATION_MS) {
                // Quiz is locked
                startQuizBtn.disabled = true;
                dailyNotice.style.display = 'block';
                document.getElementById('noticeText').textContent = '📅 You have already played. Next quiz available in:';

                // Start countdown
                this.startCountdown(lastPlayed);
            } else {
                // Lock expired
                startQuizBtn.disabled = initialNoticeText.includes('اہم غلطی');
                dailyNotice.style.display = initialNoticeText.includes('اہم غلطی') ? 'block' : 'none'; 
                countdownTimer.textContent = '';
                if (!initialNoticeText.includes('اہم غلطی')) {
                     localStorage.removeItem('lastPlayedTimestamp');
                }
            }
        } else {
            // Never played or lock expired
            startQuizBtn.disabled = document.getElementById('noticeText').textContent.includes('اہم غلطی');
            dailyNotice.style.display = document.getElementById('noticeText').textContent.includes('اہم غلطی') ? 'block' : 'none';
        }
    }

    startCountdown(lastPlayed) {
        const countdownTimer = document.getElementById('countdownTimer');

        if (this.lockTimer) clearInterval(this.lockTimer);

        this.lockTimer = setInterval(() => {
            const now = new Date().getTime();
            const timePassed = now - parseInt(lastPlayed);
            const timeRemaining = QUIZ_DURATION_MS - timePassed;

            if (timeRemaining <= 0) {
                clearInterval(this.lockTimer);
                this.checkQuizLock(); 
                return;
            }

            const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

            countdownTimer.textContent = `${hours}h ${minutes}m ${seconds}s`;
        }, 1000);
    }


    // --- QUIZ SETUP/FLOW (MODIFIED) ---

    startQuiz() {
        if (!window.quizQuestions || !Array.isArray(window.quizQuestions) || window.quizQuestions.length < NUM_QUESTIONS) {
            alert("اہم غلطی: کوئز کے سوالات لوڈ نہیں ہو سکے یا file/syntax غلط ہے۔ براہ کرم questions.js چیک کریں!");
            return;
        }

        this.currentQuestionIndex = 0;
        this.finalScore = 0;
        this.answers = [];
        this.selectRandomQuestions();
        this.showScreen('quizScreen');
        this.displayQuestion();
    }

    selectRandomQuestions() {
        const shuffled = window.quizQuestions.sort(() => 0.5 - Math.random());
        // Ensure that there are enough questions to select from
        this.randomQuestions = shuffled.slice(0, NUM_QUESTIONS);
    }

    // --- QUESTION & TIMER LOGIC (MODIFIED) ---

    displayQuestion() {
        const questionData = this.randomQuestions[this.currentQuestionIndex];
        // Question text is in Urdu (RTL is handled by CSS)
        document.getElementById('questionText').textContent = questionData.question; 

        this.hasAnswered = false;
        this.timeTaken = 0;
        document.getElementById('nextQuestion').disabled = true;

        const progress = ((this.currentQuestionIndex) / NUM_QUESTIONS) * 100;
        document.getElementById('progress').style.width = progress + '%';
        document.getElementById('questionCount').textContent = `Question ${this.currentQuestionIndex + 1}/${NUM_QUESTIONS}`;

        const optionsContainer = document.getElementById('optionsContainer');
        optionsContainer.innerHTML = '';
        // Options are in English
        questionData.options.forEach((option, index) => { 
            const button = document.createElement('button');
            button.textContent = option;
            button.className = 'option-btn';
            button.onclick = () => this.selectOption(index, button);
            optionsContainer.appendChild(button);
        });

        this.startTimer();
    }

    // ... (startTimer remains the same) ...

    // ... (selectOption remains the same) ...

    recordAnswer(selectedIndex) {
        const questionData = this.randomQuestions[this.currentQuestionIndex];
        const isCorrect = selectedIndex === questionData.correct;
        // timeTaken is now the accurate time (1 to 20)
        const timeAtAnswer = this.timeTaken; 
        let scoreEarned = 0;
        let pointsLost = 0;

        if (isCorrect) {
            if (timeAtAnswer <= PENALTY_START_TIME) {
                scoreEarned = CORRECT_SCORE;
            } else {
                const penaltyTime = timeAtAnswer - PENALTY_START_TIME;
                pointsLost = penaltyTime * PENALTY_PER_SECOND;
                scoreEarned = Math.max(0, CORRECT_SCORE - pointsLost); 
            }
            this.finalScore += scoreEarned;
        }

        this.answers.push({
            question: questionData.question,
            isCorrect: isCorrect,
            time: timeAtAnswer,
            score: scoreEarned,
            pointsLost: pointsLost,
            questionNumber: this.currentQuestionIndex + 1
        });
    }

    nextQuestion() {
        if (this.timer) clearInterval(this.timer);
        this.currentQuestionIndex++;

        if (this.currentQuestionIndex < NUM_QUESTIONS) {
            this.displayQuestion();
        } else {
            this.endQuiz();
        }
    }

    // --- RESULT & DATA HANDLING (MODIFIED) ---

    endQuiz() {
        // Only set the lock timestamp after the quiz is completed
        localStorage.setItem('lastPlayedTimestamp', new Date().getTime().toString());

        this.showScreen('userInfoScreen');
        document.getElementById('currentScoreDisplay').textContent = `Your Score: ${this.finalScore}/${QUIZ_TOTAL_SCORE}`;
    }

    collectUserInfoAndSave() {
        this.userInfo.name = document.getElementById('fullName').value;
        this.userInfo.contact = document.getElementById('contactNumber').value;
        this.userInfo.address = document.getElementById('address').value;
        this.userInfo.state = document.getElementById('state').value; 

        if (this.validateUserInfo()) {
            // STEP 1: SILENTLY SAVE DATA TO GOOGLE SHEETS
            this.sendToGoogleSheets(); 

            // STEP 2: Show Full Score Detail
            this.displayFullResults();
        }
    }

    validateUserInfo() {
        if (!this.userInfo.name || !this.userInfo.contact || !this.userInfo.address || !this.userInfo.state) {
            alert('Please fill all fields');
            return false;
        }
        return true;
    }

    // MODIFIED: Send data to Google Sheets
    sendToGoogleSheets() {
        const quizData = {
            // ACTION for Google Script
            action: 'saveScore', 
            // User Info
            Name: this.userInfo.name,
            Contact: this.userInfo.contact, // Changed from 'Contact Number' for simple key
            Address: this.userInfo.address,
            State: this.userInfo.state,
            // Quiz Info
            Score: this.finalScore,
            TotalQuestions: NUM_QUESTIONS,
            Timestamp: new Date().toISOString()
        };

        // Silence the operation
        fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors', 
            body: new URLSearchParams(quizData).toString()
        }).then(() => {
            console.log('Quiz data silently sent to Google Sheets.');
        }).catch(error => {
            console.error('Error sending data to Google Sheets:', error);
        });
    }

    // Display the detailed result screen (MODIFIED)
    displayFullResults() {
        this.showScreen('resultScreen');

        // Update Share Template elements
        document.getElementById('tName').textContent = this.userInfo.name;
        document.getElementById('tScore').textContent = this.finalScore;

        // General Info
        document.getElementById('finalScore').textContent = this.finalScore;
        document.getElementById('summaryName').textContent = this.userInfo.name;
        document.getElementById('summaryScore').textContent = this.finalScore;
        document.getElementById('summaryState').textContent = this.userInfo.state;

        // Message based on score
        let message = '';
        const percentage = (this.finalScore / QUIZ_TOTAL_SCORE) * 100;

        if (percentage >= 80) {
            document.getElementById('congratsMessage').textContent = 'Excellent! 🎉';
            message = 'You have great Islamic knowledge. Keep up the learning!';
        } else if (percentage >= 60) {
            document.getElementById('congratsMessage').textContent = 'Good Job! 👍';
            message = 'Your Islamic knowledge is impressive. You are almost there!';
        } else {
            document.getElementById('congratsMessage').textContent = 'Well Played! 📚';
            message = 'Keep studying! Islam has vast knowledge to explore.';
        }
        document.getElementById('resultMessage').textContent = message;

        this.displayDetailedScore();

        // Setup image sharing (using html2canvas)
        document.getElementById('shareImage').addEventListener('click', () => {
            this.captureAndShareScore();
        });
    }

    // MODIFIED: Display brief detailed score
    displayDetailedScore() {
        const container = document.getElementById('detailedScoreContainer');
        container.innerHTML = '';

        this.answers.forEach((detail) => {
            const questionDetailDiv = document.createElement('div');
            questionDetailDiv.className = 'question-detail';
            
            const resultText = detail.isCorrect ? 'Correct' : 'Incorrect/Skipped';
            const resultColor = detail.isCorrect ? 'green' : 'red';
            
            // Brief Details as requested
            questionDetailDiv.innerHTML = `
                <p><strong>Q${detail.questionNumber}:</strong> ${detail.question}</p>
                <p style="color: ${resultColor};">
                    <strong>Result:</strong> ${resultText} 
                </p>
                <p><strong>Time:</strong> ${detail.time}s | 
                <strong>Score:</strong> ${detail.score}/${CORRECT_SCORE} points</p>
                ${detail.pointsLost > 0 ? `<p style="color: orange;"><strong>Penalty:</strong> -${detail.pointsLost} points (for answering after ${PENALTY_START_TIME}s)</p>` : ''}
                <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
            `;
            container.appendChild(questionDetailDiv);
        });
    }


    // --- LEADERBOARD & HISTORY HANDLING (NEW/MODIFIED) ---

    // Function to load and append external html2canvas library for image sharing
    loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (window.html2canvas) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // NEW: Capture and share score image
    async captureAndShareScore() {
        await this.loadHtml2Canvas();

        const templateBox = document.getElementById('shareTemplate');
        templateBox.style.display = 'block'; // Temporarily show it for capture

        html2canvas(templateBox, {
            backgroundColor: null,
            scale: 2 // Higher resolution capture
        }).then(canvas => {
            templateBox.style.display = 'none'; // Hide template again

            // Convert canvas to image URL
            const imageData = canvas.toDataURL('image/png');
            
            // Note: Direct sharing of image data URL via WhatsApp/FB is not straightforward 
            // without a server-side component. The best we can do client-side is 
            // prompt the user to download/copy the image and share the link.

            // The template and a share message is the most reliable client-side method:
            const shareMessage = `Alhamdulillah! I scored ${this.finalScore}/${QUIZ_TOTAL_SCORE} in the Islamic Quiz by AlKunooz. Check out my score! Find the quiz here: ${window.location.href}`;
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
            
            // For a better experience, open the image in a new tab for download:
            const newWindow = window.open();
            newWindow.document.write(`
                <p>Share this image manually:</p>
                <img src="${imageData}" style="width: 300px; height: 300px; border: 1px solid black;">
                <p>Or share the link on WhatsApp/Facebook:</p>
                <a href="${whatsappUrl}" target="_blank" style="background: #25D366; color: white; padding: 10px; border-radius: 5px; text-decoration: none;">Share on WhatsApp</a>
                <p>Note: Image sharing often requires downloading and manual upload due to browser security restrictions.</p>
            `);
        }).catch(error => {
            templateBox.style.display = 'none';
            alert('Failed to generate share image: ' + error.message);
        });
    }

    // MODIFIED: Fetch Leaderboard
    async fetchLeaderboard(elementId) {
        const leaderboardDiv = document.getElementById(elementId);
        leaderboardDiv.innerHTML = '<p style="text-align: center;">Loading Top Scores...</p>';

        try {
            // action=getLeaderboard parameter for Apps Script's doGet
            const response = await fetch(GOOGLE_SHEET_URL + '?action=getLeaderboard');
            const data = await response.json();

            if (data && data.scores && data.scores.length > 0) {
                this.updateLeaderboardUI(data.scores.slice(0, 10), leaderboardDiv); 
            } else {
                leaderboardDiv.innerHTML = '<p style="text-align: center;">No scores available yet. Play now!</p>';
            }
        } catch (error) {
            leaderboardDiv.innerHTML = '<p style="text-align: center; color: red;">Failed to load leaderboard. Please check the Apps Script deployment.</p>';
        }
    }

    updateLeaderboardUI(topScores, leaderboard) {
        leaderboard.innerHTML = ''; 

        topScores.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'leaderboard-item';

            // Displays Rank, Name, State, Score
            itemDiv.innerHTML = `
                <span class="rank-name"><span class="info">${index + 1}.</span> ${item.name} (${item.state})</span>
                <span class="score-points"><span class="info">${item.score}</span>/200 points</span>
            `;
            leaderboard.appendChild(itemDiv);
        });
    }

    // NEW: Fetch User History
    async fetchUserHistory(elementId) {
        const historyDiv = document.getElementById(elementId);
        historyDiv.innerHTML = '<p style="text-align: center;">Please fill your information first or check your phone number setting.</p>';

        // Try to get a contact number from local storage or previous session (optional)
        const contactNumber = localStorage.getItem('lastContactNumber') || prompt("Please enter your contact number to view history:");
        
        if (!contactNumber) {
             historyDiv.innerHTML = '<p style="text-align: center;">Contact number required to fetch history.</p>';
             return;
        }

        localStorage.setItem('lastContactNumber', contactNumber); // Store for next time

        historyDiv.innerHTML = '<p style="text-align: center;">Loading your scores for ' + contactNumber + '...</p>';

        try {
            // action=getUserHistory parameter for Apps Script's doGet
            const response = await fetch(GOOGLE_SHEET_URL + '?action=getUserHistory&contact=' + encodeURIComponent(contactNumber));
            const data = await response.json();

            if (data && data.history && data.history.length > 0) {
                this.updateHistoryUI(data.history, historyDiv);
            } else {
                historyDiv.innerHTML = '<p style="text-align: center;">No previous scores found for this number. Play your first quiz!</p>';
            }

        } catch (error) {
            historyDiv.innerHTML = '<p style="text-align: center; color: red;">Failed to load history. Please check your contact number and the Apps Script deployment.</p>';
        }
    }

    updateHistoryUI(historyData, historyDiv) {
        historyDiv.innerHTML = ''; 

        historyData.forEach((item) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'leaderboard-item';

            const dateObj = new Date(item.timestamp);
            const date = dateObj.toLocaleDateString('en-US');
            const time = dateObj.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});

            itemDiv.innerHTML = `
                <div class="info-line">
                    <span>📅 Date: ${date}</span>
                    <span>⏱️ Time: ${time}</span>
                </div>
                <div class="score-line">
                    Score: ${item.score}/${QUIZ_TOTAL_SCORE} points
                </div>
            `;
            historyDiv.appendChild(itemDiv);
        });
    }
}

// Initialize quiz when page loads
document.addEventListener('DOMContentLoaded', () => {
    const quiz = new Quiz();
    quiz.init();
    
    // The share function listener is added after displayFullResults,
    // but we can add the main setup here for consistency
    document.getElementById('shareImage').addEventListener('click', () => {
        // This is a placeholder, actual listener is inside displayFullResults
    });
});
