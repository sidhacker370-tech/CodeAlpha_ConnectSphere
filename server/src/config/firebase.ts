import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let isInitialized = false;

try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId || serviceAccount.project_id
    });
    isInitialized = true;
    console.log('Firebase Admin initialized via service account JSON.');
  } else if (serviceAccountPath) {
    initializeApp({
      credential: cert(serviceAccountPath),
      projectId: projectId
    });
    isInitialized = true;
    console.log(`Firebase Admin initialized via service account path: ${serviceAccountPath}`);
  } else if (projectId) {
    initializeApp({
      projectId: projectId
    });
    isInitialized = true;
    console.log(`Firebase Admin initialized via explicit Project ID: ${projectId}`);
  } else {
    // Fallback to default credentials or mock if in dev and no credentials found
    try {
      initializeApp({
        credential: applicationDefault()
      });
      isInitialized = true;
      console.log('Firebase Admin initialized via applicationDefault credentials.');
    } catch (defaultError) {
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        console.warn('WARNING: Firebase credentials not found. Initializing Firebase Admin in fallback mode for development.');
        initializeApp({
          projectId: 'connectsphere-dev'
        });
        isInitialized = true;
      } else {
        throw defaultError;
      }
    }
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

export { getAuth };
export const firebaseInitialized = isInitialized;

