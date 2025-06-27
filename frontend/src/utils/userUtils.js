import Cookies from 'js-cookie';
import { v4 as uuidv4 } from 'uuid';

const USER_UID_COOKIE = 'audio_chat_uid';
const USER_UID_LOCAL_STORAGE = 'audio_chat_uid_backup';

/**
 * Get or create a unique user identifier
 * Uses cookies for persistence, with localStorage as backup
 */
export function getUserUID() {
  // First try to get from cookie
  let uid = Cookies.get(USER_UID_COOKIE);
  
  // If not in cookie, try localStorage
  if (!uid) {
    uid = localStorage.getItem(USER_UID_LOCAL_STORAGE);
    if (uid) {
      // Restore to cookie if found in localStorage
      Cookies.set(USER_UID_COOKIE, uid, { expires: 365 }); // 1 year
    }
  }
  
  // If still no UID, create a new one
  if (!uid) {
    uid = uuidv4();
    setUserUID(uid);
  }
  
  return uid;
}

/**
 * Set the user UID in both cookie and localStorage
 */
export function setUserUID(uid) {
  // Store in cookie (expires in 1 year)
  Cookies.set(USER_UID_COOKIE, uid, { expires: 365 });
  
  // Store in localStorage as backup
  localStorage.setItem(USER_UID_LOCAL_STORAGE, uid);
}

/**
 * Clear the user UID from both cookie and localStorage
 */
export function clearUserUID() {
  Cookies.remove(USER_UID_COOKIE);
  localStorage.removeItem(USER_UID_LOCAL_STORAGE);
}

/**
 * Check if a valid UID exists
 */
export function hasValidUID() {
  const uid = getUserUID();
  return uid && uid.length > 0;
} 