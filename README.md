# Peer-to-Peer Learning Platform

We are currently utilizing HTML/ CSS / Node.js / Javascript /SQLite3 project for our school group project. <br><br>



READ THIS PLS TO GET THE GIST OF HOW OUR WEBSITE WORKS (FLOW OF THE SITE)-> 

https://docs.google.com/document/d/17OiwG9rmDQaGLFygZHHXRR4K_HmHCd7sJZskdv8B3j0/edit?usp=sharing<br>

# 📌 Peer Learning System – Session Flow (Post‑Matching)

This document describes the full system flow starting from when a student clicks **Connect** on a mentor.

---

## 🔘 1. Connect (Student Side)
- Student clicks **Connect** → Mentor Profile Modal opens
- Displays:
  - Name & Profile
  - Overall Rating
  - Subject Ratings (e.g., Math ⭐4.8)
  - Skills & Interests
  - Badge (Foundational / Average / Expert)
  - Feedback Highlights
- Actions:
  - ✅ Request Session
  - ❌ Not a Good Match

---

## ❌ 2. Not a Good Match (Student Side)
- If selected:
  - User selects reason:
    - Learning style mismatch
    - Too advanced / too basic
    - Communication issues
    - Other
- System actions:
  - Store feedback
  - Adjust future matching results
  - Remove mentor from current suggestions
  - Show new recommended mentors

---

## ✅ 3. Request Session (Student Side)
- Modal appears
- User selects:
  - Subject (from mentor’s subjects + ratings)
  - Preferred Date & Time
- Clicks **Send Request**

---

## ⚙️ 4. Create Session Request (Backend)
- New session request created:
  - status: `pending`
  - student_id
  - mentor_id
  - subject_id
  - preferred_time

---

## 🔔 5. Notify Mentor (System → Mentor Side)
- Mentor receives notification:  
  *“New session request from [Student Name]”*

---

## 🧑‍🏫 6. Mentor Reviews Request (Mentor Side)
- Mentor sees:
  - Student profile
  - Subject requested
  - Preferred time
- Actions:
  - ✅ Accept (confirm or modify time)
  - ❌ Reject

---

## 🔁 7. Rescheduling Loop
- If mentor proposes new time:
  - Student notified
  - Student can accept or suggest another time
- Loop continues until both agree

---

## 💥 8. Session Confirmed
- Once both agree → session confirmed

---

## 🗂️ 9. Create Final Session (Backend)
- Session record created:
  - status: `confirmed`
  - student_id
  - mentor_id
  - subject_id
  - start_time
  - end_time
  - meeting_link (initially empty)

---

## 🔗 10. Generate Meeting Link (Backend)
- Node.js calls:
  - Google Calendar API OR Zoom API
- Meeting link generated (e.g., `https://meet.google.com/xyz-abc`)

---

## 💾 11. Save Meeting Link
- Meeting link saved in session record

---

## 📅 12. Calendar Update
- Both users see session in calendar:
  - Example: *May 3 – Math – 3:00 PM*
  - Status: Confirmed
  - Button: **Join Session**

---

## 🔔 13. Notifications
- Users receive:
  - “Session confirmed”
  - “Join link”

---

## ⏰ 14. Reminder (Optional)
- System sends reminder ~30 minutes before session

---

## 🎥 15. Session Execution
- At scheduled time:
  - User clicks **Join Session**
  - Opens Zoom / Google Meet

---

## 📝 16. After Session
- System prompts student for feedback

---

## ⭐ 17. Feedback (Student Side)
- Student rates mentor:
  - Clarity
  - Helpfulness
  - Teaching Quality
  - Optional comment

---

## ⚙️ 18. Backend Updates
- System updates:
  - Mentor ratings (overall + per subject)
  - Matching system compatibility
  - Badge status (upgrade, maintain, downgrade)

---

## 💰 19. Credit System
- After completion:
  - +0.5 credit awarded (attendance‑based)

---

## 📒 20. Ledger Entry
- Record created:
  - Example: `+0.5 → Completed tutoring session (Math, May 3)`
- Ledger history is permanent

---

## 🎯 21. Quest System
- System checks:
  - Streaks
  - Participation milestones

---

## 🔁 22. Matching Improves
- Future mentor recommendations improve based on:
  - Feedback
  - User preferences
  - Mentor performance



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
