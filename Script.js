// script.js

// --- CONFIGURATION ---
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwEDpBqpPoIWceuNEhLFy3aQ9Q6WuL4N8W9JY-E-naXwl3M0rJVIWqq8rJCemmJcP9O/exec';
const QUIZ_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours lock in milliseconds
const MAX_TIME_PER_QUESTION = 20; // Seconds
const CORRECT_SCORE = 20; // Base score per question
const PENALTY_START_TIME = 10; // Penalty starts after 10 seconds
const PENALTY_PER_SECOND = 2; // 2 points deduction per second after 10s
const NUM_QUESTIONS = 5; // Number of questions per quiz

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
        this.randomQuestions = []; // To hold the 5 selected questions
        this.answers = []; // To store answer details for full score view
        this.userInfo = { name: '', contact: '', address: '', state: '' };
        this.timer = null;
        this.timeLeft = MAX_TIME_PER_QUESTION;
        this.timeTaken = 0;
        this.hasAnswered = false; // To track if user answered the current question
    }

    init() {
        this.populateStates();
        this.setupEventListeners();
        this.checkQuizLock();
    }
    
    // --- UI/Screen Management ---

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
            option.value = state.replace(/\s/g, ''); // Use value without spaces
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
            this.checkQuizLock(); // Re-check lock for display
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

        // Always attempt to fetch leaderboard on the welcome screen
        this.fetchLeaderboard(); 
    }

    startCountdown(lastPlayed) {
        const countdownTimer = document.getElementById('countdownTimer');
        
        // Clear any existing interval
        if (this.lockTimer) clearInterval(this.lockTimer);

        this.lockTimer = setInterval(() => {
            const now = new Date().getTime();
            const timePassed = now - parseInt(lastPlayed);
            const timeRemaining = QUIZ_DURATION_MS - timePassed;

            if (timeRemaining <= 0) {
                clearInterval(this.lockTimer);
                this.checkQuizLock(); // Unlock and update UI
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
        this.currentQuestionIndex = 0;
        this.finalScore = 0;
        this.answers = [];
        this.selectRandomQuestions();
        this.showScreen('quizScreen');
        this.displayQuestion();
    }

    selectRandomQuestions() {
        // Ensure quizQuestions is available from questions.js
        if (!window.quizQuestions || window.quizQuestions.length < NUM_QUESTIONS) {
            console.error("Not enough questions available.");
            this.randomQuestions = []; // Handle error case
            return;
        }

        const shuffled = quizQuestions.sort(() => 0.5 - Math.random());
        this.randomQuestions = shuffled.slice(0, NUM_QUESTIONS);
    }

    // --- QUESTION & TIMER LOGIC ---

    displayQuestion() {
        const questionData = this.randomQuestions[this.currentQuestionIndex];
        document.getElementById('questionText').textContent = questionData.question;
        
        // Reset state
        this.hasAnswered = false;
        this.timeTaken = 0;
        document.getElementById('nextQuestion').disabled = true;
        
        // Update progress
        const progress = (this.currentQuestionIndex / NUM_QUESTIONS) * 100;
        document.getElementById('progress').style.width = progress + '%';
        document.getElementById('questionCount').textContent = `Question ${this.currentQuestionIndex + 1}/${NUM_QUESTIONS}`;
        
        // Display options
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
        timerElement.classList.remove('warning'); // Reset color to green
        
        if (this.timer) clearInterval(this.timer);

        this.timer = setInterval(() => {
            this.timeLeft--;
            this.timeTaken++;
            timerElement.textContent = this.timeLeft;

            // Change timer color to red after 10 seconds
            if (this.timeLeft <= MAX_TIME_PER_QUESTION - PENALTY_START_TIME) {
                timerElement.classList.add('warning');
            } else {
                timerElement.classList.remove('warning');
            }

            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                // Auto-submit unanswered question
                if (!this.hasAnswered) {
                    this.recordAnswer(null); // Null indicates no answer
                    this.nextQuestion();
                }
            }
        }, 1000);
    }
    
    selectOption(selectedIndex, selectedButton) {
        if (this.hasAnswered) return; // Prevent double clicking
        this.hasAnswered = true;
        clearInterval(this.timer);

        const questionData = this.randomQuestions[this.currentQuestionIndex];
        const options = document.querySelectorAll('#optionsContainer .option-btn');
        
        // Disable all buttons and mark selected
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
                // Calculate penalty
                const penaltyTime = timeAtAnswer - PENALTY_START_TIME;
                pointsLost = penaltyTime * PENALTY_PER_SECOND;
                scoreEarned = Math.max(0, CORRECT_SCORE - pointsLost); // Score cannot be negative
            }
            this.finalScore += scoreEarned;
        }

        // Store answer details
        this.answers.push({
            question: questionData.question,
            isCorrect: isCorrect,
            selectedIndex: selectedIndex,
            correctIndex: questionData.correct,
            time: timeAtAnswer,
            score: scoreEarned,
            pointsLost: pointsLost
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
        document.getElementById('currentScoreDisplay').textContent = `Your Score: ${this.finalScore}/100`;
    }

    collectUserInfoAndSave() {
        this.userInfo.name = document.getElementById('fullName').value;
        this.userInfo.contact = document.getElementById('contactNumber').value;
        this.userInfo.address = document.getElementById('address').value;
        this.userInfo.state = document.getElementById('state').options[document.getElementById('state').selectedIndex].text;
        
        if (this.validateUserInfo()) {
            // Step 1: Save data to Google Sheets
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
        // Prepare data as per Google Sheet structure (A to H)
        const quizData = {
            Name: this.userInfo.name,
            'Contact Number': this.userInfo.contact,
            Address: this.userInfo.address,
            State: this.userInfo.state,
            Score: this.finalScore,
            // Timestamp and Share Link will be handled by the Apps Script
            'User Timestamp': new Date().toISOString()
        };
        
        // Use Fetch API to send data to Google Apps Script Web App
        fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors', // Essential for successful Google Sheets submission from client-side
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(quizData).toString()
        }).then(() => {
            console.log('Quiz data successfully sent to Google Sheets.');
            // Re-fetch leaderboard after saving new score
            this.fetchLeaderboard(); 
        }).catch(error => {
            console.error('Error sending data to Google Sheets:', error);
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
        const percentage = (this.finalScore / (NUM_QUESTIONS * CORRECT_SCORE)) * 100;
        
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
                <p><strong>Q${index + 1}:</strong> ${questionText}</p>
                <p style="color: ${detail.isCorrect ? 'green' : 'red'};">
                    <strong>Result:</strong> ${detail.isCorrect ? 'Correct' : 'Incorrect/Skipped'} 
                    (${detail.score}/${CORRECT_SCORE} points)
                </p>
                ${detail.isCorrect ? `<p><strong>Time Taken:</strong> ${detail.time}s</p>` : ''}
                ${detail.pointsLost > 0 ? `<p style="color: orange;"><strong>Time Penalty:</strong> -${detail.pointsLost} points</p>` : ''}
                <p><strong>Correct Answer:</strong> ${correctOption}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
            `;
            container.appendChild(questionDetailDiv);
        });
    }

    // --- LEADERBOARD & SHARING ---
    
    // Fetch top 10 scores from Google Sheets
    async fetchLeaderboard() {
        const leaderboardDiv = document.getElementById('leaderboard');
        leaderboardDiv.innerHTML = '<p style="text-align: center;">Loading Top Scores...</p>';
        
        try {
            // Assuming your Apps Script returns JSON data for the leaderboard
            // Append an action parameter to the URL to trigger the fetch function in Apps Script
            const response = await fetch(GOOGLE_SHEET_URL + '?action=getLeaderboard');
            const data = await response.json();
            
            if (data && data.scores && data.scores.length > 0) {
                this.updateLeaderboardUI(data.scores.slice(0, 10)); // Display Top 10
            } else {
                leaderboardDiv.innerHTML = '<p style="text-align: center;">No scores available yet.</p>';
            }
        } catch (error) {
            console.error("Could not fetch leaderboard:", error);
            leaderboardDiv.innerHTML = '<p style="text-align: center; color: red;">Failed to load leaderboard. (Check Apps Script)</p>';
        }
    }

    updateLeaderboardUI(topScores) {
        const leaderboard = document.getElementById('leaderboard');
        leaderboard.innerHTML = ''; // Clear existing content

        topScores.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'leaderboard-item';
            
            // Assuming Google Sheet returns data as { name: "...", state: "...", score: X }
            itemDiv.innerHTML = `
                <span class="rank-name"><span class="info">${index + 1}.</span> ${item.name} (${item.state})</span>
                <span class="score-points"><span class="info">${item.score}</span> points</span>
            `;
            leaderboard.appendChild(itemDiv);
        });
    }

    // Sharing functions
    shareOnWhatsApp() {
        const message = `Alhamdulillah! I scored ${this.finalScore}/100 in the Islamic Quiz by AlKunooz. Test your knowledge too!`;
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }
    
    shareOnFacebook() {
        const message = `Alhamdulillah! I scored ${this.finalScore}/100 in the Islamic Quiz by AlKunooz. Test your knowledge too!`;
        // Facebook sharer works better with a URL, assume your quiz page URL is the share target
        const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(message)}&u=${encodeURIComponent(window.location.href)}`;
        window.open(url, '_blank');
    }
}

// Initialize quiz when page loads
document.addEventListener('DOMContentLoaded', () => {
    const quiz = new Quiz();
    quiz.init();
    
    // Setup sharing listeners after initialization
    document.getElementById('shareWhatsApp').addEventListener('click', () => quiz.shareOnWhatsApp());
    document.getElementById('shareFacebook').addEventListener('click', () => quiz.shareOnFacebook());
});
