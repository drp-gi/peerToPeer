# Peer-to-Peer Learning Platform

We are currently utilizing HTML/ CSS / Node.js / Javascript /SQLite3 project for our school group project. <br><br>



READ THIS PLS TO GET THE GIST OF HOW OUR WEBSITE WORKS (FLOW OF THE SITE)-> 

https://docs.google.com/document/d/17OiwG9rmDQaGLFygZHHXRR4K_HmHCd7sJZskdv8B3j0/edit?usp=sharing<br>

# 📌 Session Flow (Core Module)

🔘 **START POINT: User clicks “CONNECT”**

1. **Mentor Profile Modal Opens (Student Side)**  
   User sees:  
   - Name + profile  
   - Overall rating  
   - Subject ratings (e.g., Math ⭐4.8, English ⭐4.2)  
   - Skills + interests  
   - Badge (Foundational / Average / Expert)  
   - Feedback highlights  
   - Buttons: ✅ Request Session / ❌ Not a good match  

2. **If User Clicks “Request Session” (Student Side)**  
   Popup appears:  
   - 📚 Subject (dropdown from mentor’s subjects + ratings)  
   - 👥 Session type: One‑on‑one / Group  
   - 🕒 Preferred date & time  
   - 👉 Send Request  

3. **Backend Action (System)**  
   Creates a **SESSION REQUEST RECORD**:  
   - status: "pending"  
   - student_id  
   - mentor_id  
   - subject  
   - preferred_time  
   - session_type  

4. **Notification Triggered (System → Mentor Side)**  
   Mentor receives: *“New session request from [Student]”*  

5. **Mentor Opens Request (Mentor Side)**  
   Mentor sees:  
   - student profile  
   - subject requested  
   - preferred time  
   - session type  

6. **Mentor Decision (Mentor Side)**  
   - ✅ ACCEPT → confirm time OR propose new time  
   - ❌ REJECT  

7. **If Mentor Proposes New Time (Mentor Side)**  
   - System sends notification to student  
   - Student: Accepts new time OR rejects/suggests again  
   - 👉 Loop continues until both agree  

8. **When Both Agree (Critical Point)**  
   💥 Session is confirmed  

9. **Backend Creates Final Session (System)**  
   - status: "confirmed"  
   - final_date  
   - final_time  
   - student_id  
   - mentor_id  
   - subject  
   - session_type  

10. **Meeting Link Generation (System)**  
    - Node.js calls Zoom API or Google Calendar API  
    - Generates meeting link (e.g., `https://meet.google.com/xyz-abc`)  

11. **Save Link to Session (System)**  
    - meeting_link: "https://..."  

12. **Calendar Update (Student + Mentor Side)**  
    Both users see:  
    - 📅 Example: May 3 – Math – 3:00 PM  
    - Status: Confirmed  
    - Button: “Join Session”  

13. **Notifications Sent (System)**  
    - “Session confirmed”  
    - “Click here to join”  

14. **Before Session (Optional)**  
    - Reminder notifications (30 mins before)  

15. **Session Time (Student + Mentor Side)**  
    - User clicks 👉 Join Session  
    - Opens Zoom / Google Meet  

16. **After Session Ends (System)**  
    - Trigger feedback prompt  

17. **Feedback System (Student Side)**  
    Student rates mentor:  
    - clarity  
    - helpfulness  
    - teaching quality  
    - Optional: written feedback  

18. **Backend Updates (System)**  
    - 🧠 Matching system adjusts compatibility scores  
    - ⭐ Mentor ratings updated (overall + subject)  
    - 🏅 Badge system checks for upgrade/downgrade  

19. **Credit System Trigger (System)**  
    - Student credits (if applicable)  
    - Mentor credits  

20. **Ledger Record Created (System)**  
    - +0.5 credit → attended group session  
    - +3 credits → weekly streak  
    - Nothing deleted; full history kept  

21. **Quest System Update (System)**  
    - Checks streaks, participation, rewards  

22. **Matching System Improves (System)**  
    - Next time student searches: bad matches removed, better mentors ranked higher  


<br><br><br>







<br>

## Setup Instructions
1. **Clone the repo**
- After watching the tutorial GIT videos I sent on Google Chats, you may utilize text editors such as Visual Studio Code
- Make sure you have Git installed - https://git-scm.com/install/windows
- Also node.js - https://nodejs.org/en/download
  <br>
- In the terminal section of VS CODE type
   ```bash
     git --version 
    ```
If it shows a git version THEN you successfully installed Git <br><br>



Type this to now clone our projects repo to your pc <br>

```bash
    git clone https://github.com/drp-gi/peerToPeer.git
    cd peerToPeer
```

 <br><br>
2. Install dependencies -  It downloads and adds packages (extra tools/libraries) into your Node.js project so you can use them in your code.
```bash
        npm install
```

3. Run the Server - This is so that you can view our website, how it looks and works
    ```bash
    node server.js
    ```

4. Open the project in your browser
   - Go to http://localhost:3000 (or whichever port your server uses). <br><br><br><br><br>
  
5. Make a branch of the project through here, branch in simpler terms is your personal copy of all the main code where you can test, debug and create your own parts
     <img width="1347" height="732" alt="image" src="https://github.com/user-attachments/assets/4fa1a68d-7926-41ea-901a-323b36d37b76" />

6. Start adding your own parts, adding features and stuff you are assigned to
   After you are done and your part is working\
   <img width="1348" height="727" alt="image" src="https://github.com/user-attachments/assets/8e007e34-c3da-48a0-8718-bc31520a579a" />

   <img width="1346" height="727" alt="image" src="https://github.com/user-attachments/assets/4146cc3e-7f17-4123-a9a9-c5dd91ef50e1" />

   <img width="1491" height="852" alt="image" src="https://github.com/user-attachments/assets/21cd6e6b-9688-4a6f-ad4b-d484dd21427b" />

   <img width="1429" height="752" alt="image" src="https://github.com/user-attachments/assets/0624c255-dae4-4d86-b6d6-aaa84ec41fdf" />

<img width="1198" height="630" alt="image" src="https://github.com/user-attachments/assets/6c4bbcbf-9d30-4fd3-b6b5-f089a5a5c2ca" />


<img width="1487" height="757" alt="image" src="https://github.com/user-attachments/assets/08954093-a632-4d20-998c-6582a69656f1" />


   <img width="1402" height="668" alt="image" src="https://github.com/user-attachments/assets/cbb90ce3-15f4-4d04-b474-66a2975fe30c" />

<img width="1400" height="669" alt="image" src="https://github.com/user-attachments/assets/06c9bd6b-fd45-4bf2-b6a0-5df10dacc155" />

<img width="1315" height="628" alt="image" src="https://github.com/user-attachments/assets/1479197a-f43a-4643-b9fa-e4320c54cca3" />

<img width="1128" height="608" alt="image" src="https://github.com/user-attachments/assets/f372b949-0ff5-4ab5-acce-7c3a1e96a00b" />



\Nice job on vreating a branch then merging it to the main branch!!




**Notes**
everytime you wanna run ur website you type this, on the terminal on your vs code
``` bash
node server.js 
```
then click/open the http://localhost:3000
<br>
node_modules/ and users.db are ignored by Git.
Make sure to run npm install before running the server.
If you add new dependencies, don’t forget to run npm install again.
