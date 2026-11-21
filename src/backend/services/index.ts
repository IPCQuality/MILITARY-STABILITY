export {
  clearLegacyDemoStorage,
  firebaseProjectConfig,
  handleFirestoreError,
  normalizeApprovalStatus,
  normalizeUserRole,
  OperationType,
  PRIMARY_ADMIN_EMAIL,
  testFirestoreConnection,
  WORKSPACE_ID,
  type FirestoreErrorInfo,
} from './firebaseShared';

export {
  ensureFirebaseUserProfile,
  extractOAuthErrorFromUrl,
  mapAuthErrorMessage,
  resetPasswordFirebase,
  signInFirebase,
  signInWithGoogleFirebase,
  signOutFirebase,
  signUpFirebase,
} from './authService';

export {
  subscribeUsersForAdmin,
  updateUserApprovalByAdmin,
  type AdminManagedUser,
} from './adminService';

export {
  createReportFirebase,
  loadReportsFirebase,
  subscribeReportsFirebase,
  updateReportFirebase,
} from './reportService';
