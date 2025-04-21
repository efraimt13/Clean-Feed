// utils/storage.js – Helper module for storage operations

export function getStorageValue(key, defaultValue) {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ [key]: defaultValue }, (result) => {
        resolve(result[key]);
      });
    });
  }
  
  export function setStorageValue(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        resolve();
      });
    });
  }
  