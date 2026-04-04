## Run the backend

cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

## Front End 
cd frontend
npm install
npm run dev     # http://localhost:5173

## Mobile

# Install Node.js 20+ if not already installed
# Install Expo CLI
npm install -g expo-cli@latest

# Install dependencies
cd mobile
npm install

npm run ios        # Opens iOS Simulator (Mac only, requires Xcode)
npm run android    # Opens Android Emulator (requires Android Studio)
npm run web        # Opens in browser



# Android Build

npx expo prebuild --platform android
cd android
./gradlew assembleRelease

./gradlew assembleDebug




Email:    admin@demo.com
Password: Admin1234!

  