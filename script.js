// script.js

// --- CONFIGURATION ---
// REPLACE THIS WITH YOUR ACTUAL GOOGLE APPS SCRIPT URL
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwEDpBqpPoIWceuNEhLFy3aQ9Q6WuL4N8W9JY-E-naXwl3M0rJVIWqq8rJCemmJcP9O/exec'; 
const QUIZ_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours lock in milliseconds
const MAX_TIME_PER_QUESTION = 20; // Seconds
const CORRECT_SCORE = 20; // Base score per question
const PENALTY_START_TIME = 10; // Penalty starts after 10 seconds
const PENALTY_PER_SECOND = 2; // 2 points deduction per second after 10s
const NUM_QUESTIONS = 5; // Number of questions per quiz
const QUIZ_TOTAL_SCORE = NUM_QUESTIONS * CORRECT_SCORE;

// Full list of Indian states/UTs for dropdown
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
    }

    init() {
        // Safety check for questions data
        if (!window.quizQuestions || window.quizQuestions.length < NUM_QUESTIONS) {
            console.error("FATAL ERROR: Questions array not found or too small. Check questions.js syntax.");
            document.getElementById('startQuiz').disabled = true;
            document.getElementById('noticeText').textContent = '⚠️ Quiz questions not loaded! Check question file.';
            return;
        }

        this.populateStates();
        this.setupEventListeners();
        this.checkQuizLock();
    }
    
    // --- UI/Screen Management & Setup ---

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
            this.collectUserInfoAndSave();
        });
        document.getElementById('nextQuestion').addEventListener('click', () => {
            this.nextQuestion();
        });
        document.getElementById('playAgain').addEventListener('click', () => {
            this.showScreen('welcomeScreen');
            this.checkQuizLock(); 
        });
    }
    
    // --- QUIZ LOCK/COUNTDOWN LOGIC (12 Hours) ---

    checkQuizLock() {
        const lastPlayed = localStorage.getItem('lastPlayedTimestamp');
        const now = new Date().getTime();
        const startQuizBtn = document.getElementById('startQuiz');
        const dailyNotice = document.getElementById('dailyNotice');
        const countdownTimer = document.getElementById('countdownTimer');

        if (lastPlayed) {
            const timeElapsed = now - parseInt(lastPlayed);
            
            if (timeElapsed < QUIZ_DURATION_MS) {
                // Quiz is locked
                startQuizBtn.disabled = true;
                dailyNotice.style.display = 'block';
                document.getElementById('noticeText').textContent = '📅 You have already played today. Come back tomorrow!';

                // Start countdown
                this.startCountdown(lastPlayed);
            } else {
                // Lock expired
                startQuizBtn.disabled = false;
                dailyNotice.style.display = 'none';
                countdownTimer.textContent = '';
                localStorage.removeItem('lastPlayedTimestamp');
            }
        } else {
            // Never played or lock expired
            startQuizBtn.disabled = false;
            dailyNotice.style.display = 'none';
        }

        this.fetchLeaderboard('welcomeLeaderboard'); 
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

            countdownTimer.textContent = `Time remaining: ${hours}h ${minutes}m ${seconds}s`;
        }, 1000);
    }


    // --- QUIZ SETUP/FLOW ---

    startQuiz() {
        if (!window.quizQuestions || window.quizQuestions.length < NUM_QUESTIONS) {
            alert("Error: Quiz questions not fully loaded. Check your questions.js file!");
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
        // Ensure quizQuestions is globally defined (from questions.js)
        const shuffled = window.quizQuestions.sort(() => 0.5 - Math.random());
        this.randomQuestions = shuffled.slice(0, NUM_QUESTIONS);
    }

    // --- QUESTION & TIMER LOGIC ---

    displayQuestion() {
        const questionData = this.randomQuestions[this.currentQuestionIndex];
        document.getElementById('questionText').textContent = questionData.question;
        
        this.hasAnswered = false;
        this.timeTaken = 0;
        document.getElementById('nextQuestion').disabled = true;
        
        const progress = ((this.currentQuestionIndex) / NUM_QUESTIONS) * 100;
        document.getElementById('progress').style.width = progress + '%';
        document.getElementById('questionCount').textContent = `Question ${this.currentQuestionIndex + 1}/${NUM_QUESTIONS}`;
        
        const optionsContainer = document.getElementById('optionsContainer');
        optionsContainer.innerHTML = '';
        questionData.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.textContent = option;
            button.className = 'option-btn';
            button.onclick = () => this.selectOption(index, button);
            optionsContainer.appendChild(button);
        });

        this.startTimer();
    }

    startTimer() {
        this.timeLeft = MAX_TIME_PER_QUESTION;
        const timerElement = document.getElementById('timer');
        timerElement.textContent = this.timeLeft;
        timerElement.classList.remove('warning'); 
        
        if (this.timer) clearInterval(this.timer);

        this.timer = setInterval(() => {
            this.timeLeft--;
            this.timeTaken++;
            timerElement.textContent = this.timeLeft;

            // Timer color logic
            if (this.timeLeft <= MAX_TIME_PER_QUESTION - PENALTY_START_TIME) {
                timerElement.classList.add('warning');
            } else {
                timerElement.classList.remove('warning');
            }

            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                if (!this.hasAnswered) {
                    this.recordAnswer(null); 
                    this.nextQuestion();
                }
            }
        }, 1000);
    }
    
    selectOption(selectedIndex, selectedButton) {
        if (this.hasAnswered) return; 
        this.hasAnswered = true;
        clearInterval(this.timer);

        const options = document.querySelectorAll('#optionsContainer .option-btn');
        
        options.forEach(button => {
            button.disabled = true;
        });
        selectedButton.classList.add('selected');
        
        this.recordAnswer(selectedIndex);
        document.getElementById('nextQuestion').disabled = false;
    }

    recordAnswer(selectedIndex) {
        const questionData = this.randomQuestions[this.currentQuestionIndex];
        const isCorrect = selectedIndex === questionData.correct;
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

        // Store answer details for result screen
        this.answers.push({
            question: questionData.question,
            isCorrect: isCorrect,
            selectedIndex: selectedIndex,
            correctIndex: questionData.correct,
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

    // --- RESULT & DATA HANDLING ---

    endQuiz() {
        // Set the lock timestamp immediately
        localStorage.setItem('lastPlayedTimestamp', new Date().getTime().toString());
        
        // Show only score and user info form
        this.showScreen('userInfoScreen');
        document.getElementById('currentScoreDisplay').textContent = `Your Score: ${this.finalScore}/${QUIZ_TOTAL_SCORE}`;
    }

    collectUserInfoAndSave() {
        this.userInfo.name = document.getElementById('fullName').value;
        this.userInfo.contact = document.getElementById('contactNumber').value;
        this.userInfo.address = document.getElementById('address').value;
        this.userInfo.state = document.getElementById('state').value; // Get actual state value
        
        if (this.validateUserInfo()) {
            // Step 1: Save data to Google Sheets (silent operation)
            this.sendToGoogleSheets();
            
            // Step 2: Show Full Score Detail
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

    sendToGoogleSheets() {
        const quizData = {
            // Mapping to your Google Sheet Columns B to G
            Name: this.userInfo.name,
            'Contact Number': this.userInfo.contact,
            Address: this.userInfo.address,
            State: this.userInfo.state,
            Score: this.finalScore,
            'User Timestamp': new Date().toISOString()
        };
        
        // Using 'no-cors' mode is crucial for POSTing to Apps Script from GitHub Pages
        fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors', 
            body: new URLSearchParams(quizData).toString()
        }).then(() => {
            console.log('Quiz data silently sent to Google Sheets.');
            // No need to re-fetch immediately, will fetch on next welcome screen load
        }).catch(error => {
            console.error('Error sending data to Google Sheets (CORS/Network issue likely):', error);
            // Quiz continues to result screen even if data saving fails
        });
    }

    // Display the detailed result screen
    displayFullResults() {
        this.showScreen('resultScreen');

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
    }

    displayDetailedScore() {
        const container = document.getElementById('detailedScoreContainer');
        container.innerHTML = '';

        this.answers.forEach((detail, index) => {
            const questionDetailDiv = document.createElement('div');
            questionDetailDiv.className = 'question-detail';
            
            const questionText = this.randomQuestions[index].question;
            const correctOption = this.randomQuestions[index].options[detail.correctIndex];
            
            questionDetailDiv.innerHTML = `
                <p><strong>Q${detail.questionNumber}:</strong> ${questionText}</p>
                <p style="color: ${detail.isCorrect ? 'green' : 'red'};">
                    <strong>Result:</strong> ${detail.isCorrect ? 'Correct' : 'Incorrect/Skipped'} 
                    (${detail.score}/${CORRECT_SCORE} points)
                </p>
                <p><strong>Time Taken:</strong> ${detail.time}s</p>
                ${detail.pointsLost > 0 ? `<p style="color: orange;"><strong>Time Penalty:</strong> -${detail.pointsLost} points (for answering after ${PENALTY_START_TIME}s)</p>` : ''}
                <p><strong>Correct Answer:</strong> ${correctOption}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
            `;
            container.appendChild(questionDetailDiv);
        });
    }

    // --- LEADERBOARD & SHARING ---
    
    async fetchLeaderboard(elementId) {
        const leaderboardDiv = document.getElementById(elementId);
        if (!leaderboardDiv) return;

        leaderboardDiv.innerHTML = '<p style="text-align: center;">Loading Top Scores...</p>';
        
        try {
            // Need the 'action=getLeaderboard' parameter for Apps Script's doGet
            const response = await fetch(GOOGLE_SHEET_URL + '?action=getLeaderboard');
            const data = await response.json();
            
            if (data && data.scores && data.scores.length > 0) {
                this.updateLeaderboardUI(data.scores.slice(0, 10), leaderboardDiv); 
            } else {
                leaderboardDiv.innerHTML = '<p style="text-align: center;">No scores available yet. Play now!</p>';
            }
        } catch (error) {
            console.error("Could not fetch leaderboard (CORS/Network):", error);
            // This error confirms the CORS issue and tells the user to check their Apps Script deployment
            leaderboardDiv.innerHTML = '<p style="text-align: center; color: red;">Failed to load leaderboard. Please check the Apps Script deployment permissions.</p>';
        }
    }

    updateLeaderboardUI(topScores, leaderboard) {
        leaderboard.innerHTML = ''; 

        topScores.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'leaderboard-item';
            
            itemDiv.innerHTML = `
                <span class="rank-name"><span class="info">${index + 1}.</span> ${item.name} (${item.state})</span>
                <span class="score-points"><span class="info">${item.score}</span> points</span>
            `;
            leaderboard.appendChild(itemDiv);
        });
    }

    shareOnWhatsApp() {
        const message = `Alhamdulillah! I scored ${this.finalScore}/${QUIZ_TOTAL_SCORE} in the Islamic Quiz by AlKunooz. Test your knowledge too! Find the quiz here: ${window.location.href}`;
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }
    
    shareOnFacebook() {
        const message = `Alhamdulillah! I scored ${this.finalScore}/${QUIZ_TOTAL_SCORE} in the Islamic Quiz by AlKunooz. Test your knowledge too!`;
        const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(message)}&u=${encodeURIComponent(window.location.href)}`;
        window.open(url, '_blank');
    }
}

// Initialize quiz when page loads
document.addEventListener('DOMContentLoaded', () => {
    const quiz = new Quiz();
    quiz.init();
    
    document.getElementById('shareWhatsApp').addEventListener('click', () => quiz.shareOnWhatsApp());
    document.getElementById('shareFacebook').addEventListener('click', () => quiz.shareOnFacebook());
});
