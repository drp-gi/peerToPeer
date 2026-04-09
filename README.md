# Peer-to-Peer Learning Platform

U am currently utilizing HTML/ CSS / Node.js / Javascript /SQLite3 project for our school group project. \
READ THIS PLS TO GET THE GIST OF HOW OUR WEBSITE WORKS (FLOW OF THE SITE)-> https://docs.google.com/document/d/17OiwG9rmDQaGLFygZHHXRR4K_HmHCd7sJZskdv8B3j0/edit?usp=sharing

Folder directory as of April 9, 2026 \
peerToPeer/ \
│ server.js \
│ package.json \
│ package-lock.json \
│ .gitignore \
│ README.md \
└───public/ \
│ index.html \
│ style.css \
│ script.js \
| complete-profile.html \
|complete-profile.js

CODED PARTS CUURENTLY LOOKS LIKE THIS
- First page
<img width="1894" height="905" alt="image" src="https://github.com/user-attachments/assets/66b1fd43-b3f9-4afe-a41e-4375f1c512af" />
-Register Page
<img width="1890" height="903" alt="image" src="https://github.com/user-attachments/assets/7a495ea3-f121-4d2c-867c-88f144532c08" />
Since the user registered earlier, their email has been saved to the database, so there will be an alert that they can't use the account
<img width="1906" height="1016" alt="image" src="https://github.com/user-attachments/assets/eec62a3b-b877-47af-9dca-7abbebbafcab" /> \

-After Register Page for users who did not register before
<img width="1907" height="934" alt="image" src="https://github.com/user-attachments/assets/5431efa4-7a2e-473f-a794-029ca724555a" /> \

It will then proceed to a new page, where the user needs to complete their credentials to proceed to dashboard
<img width="1894" height="908" alt="image" src="https://github.com/user-attachments/assets/c3da3c19-3dbf-4fbc-88d6-be4e2cfbd42b" />


User then fills up credentials such as adding a profile pic, username, skills, and growth(meaning areas where they need help with)
<img width="1892" height="906" alt="image" src="https://github.com/user-attachments/assets/81e9d39e-6ae2-41c4-b97c-a2a2fcb9a7a0" />


BUT When clicking proceed to dashboard it has an ERROR, idk why, I cant read codes \
Next step - > when clicking Proceed to DashBoard button it should open dashboard.html

THAT'S ALL that has been done - AYA (April 9, 2026)

## Setup Instructions
1. **Clone the repo**
- After watching the tutorial GIT videos I sent on Google Chats, you may utilize text editors such as Visual Studio Code
- In the terminal section type

    ```bash
    git clone https://github.com/drp-gi/peerToPeer.git
    cd peerToPeer
    ```
2. Install dependencies
    ```bash
    npm install
    ```

3. Run the Server
    ```bash
    node server.js
    ```

4. Open the project in your browser
   - Go to http://localhost:3000 (or whichever port your server uses).
  
  5. Start testing project, remeber the terms CLONE, ADD, COMMIT, PUSH

**Notes**
node_modules/ and users.db are ignored by Git.
Make sure to run npm install before running the server.
If you add new dependencies, don’t forget to run npm install again.
