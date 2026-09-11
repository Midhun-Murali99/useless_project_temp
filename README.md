<img width="1280" height="640" alt="git (1)" src="https://github.com/user-attachments/assets/8920b256-2ba8-4988-b824-5351134eb4bd" />



# Doomsday: Object Doom Predictor 🎯


## Basic Details
### Team Name: UselessDev


### Team Members
- Team Lead: Midhun Murali - Sahrdaya College of Engineering and Technology
- Member 2: P V Aadithyadev - Sahrdaya College of Engineering and Technology

### Project Description
Doomsday is a humorous AI-powered object analysis application. Users can upload an image or use their camera to detect an object, select it, and receive a fictional prediction about its inevitable doom. The application combines real-time computer vision with an interactive DoomOS report containing a doom score, evidence, and a dramatic fate.

### The Problem (that doesn't exist)
People own objects every day without knowing how those objects will eventually disappoint them. This creates a completely unnecessary lack of doom awareness, leaving users unprepared for cracked screens, empty batteries, spilled coffee, and other inevitable object tragedies.

### The Solution (that nobody asked for)
Doomsday uses camera-based object detection and AI-generated analysis to inspect everyday belongings. After identifying an object, it sends the relevant image to the prediction service and presents a playful DoomOS report with a score from 0 to 100, visual evidence, cause of death, time until doom, last words, and a funeral note.

## Technical Details
### Technologies/Components Used
For Software:
- Languages: TypeScript, CSS
- Frameworks: Next.js, React, Tailwind CSS
- Libraries: TensorFlow.js, COCO-SSD, OpenAI SDK, Zod, Prisma
- Tools: Node.js, npm, Git, browser camera APIs

For Hardware:
- A computer or mobile device with a browser
- A working camera for live object detection
- No additional hardware is required

### Implementation
For Software:
# Installation
```bash
npm install
```

# Run
```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Configure the required environment variables in `.env` before using AI prediction and database features.

### Project Documentation
For Software:

# Screenshots
Screenshots can be added here after capturing the upload, camera detection, and DoomOS result screens.

# Workflow
1. The user uploads an image or starts the live camera.
2. TensorFlow.js and COCO-SSD detect objects in the camera view.
3. The user selects a detected object and its bounding box is cropped from the current frame.
4. The cropped image, or uploaded image, is sent to `/api/predict`.
5. The AI generates a fictional DoomOS report.
6. Prisma stores the object and prediction details, and the result is displayed to the user.

For Hardware:

# Schematic & Circuit
![Circuit](Add your circuit diagram here)
*Add caption explaining connections*

![Schematic](Add your schematic diagram here)
*Add caption explaining the schematic*

# Build Photos
![Components](Add photo of your components here)
*List out all components shown*

![Build](Add photos of build process here)
*Explain the build steps*

![Final](Add photo of final product here)
*Explain the final build*

### Project Demo
# Video
Add the project demonstration video link here.

# Additional Demos
The application supports both upload-based prediction and real-time camera-based object analysis.

## Team Contributions
- Midhun Murali: Project architecture, AI/API integration, database setup, real-time object detection, and camera analysis workflow.
- P V Aadithyadev: Frontend development.

---
Made with ❤️ at TinkerHub Useless Projects 

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--26-26?link=https%3A%2F%2Ftinkerhub.org%2Fevents%2F1M8ORET9A1%2Fuseless-projects-3.0)
