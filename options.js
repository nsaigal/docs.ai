// Options page script to handle media permissions

let cameraStream = null;
let microphoneStream = null;

// Update status badge
function updateStatus(elementId, status) {
  const badge = document.getElementById(elementId);
  badge.className = `status-badge ${status}`;
  badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
}

// Show preview video
function showPreview(previewId, stream) {
  const preview = document.getElementById(previewId);
  const video = preview.querySelector('video');
  video.srcObject = stream;
  preview.classList.add('show');
}

// Request camera permission
async function requestCamera() {
  const button = document.getElementById('request-camera');
  button.disabled = true;
  button.textContent = 'Requesting...';

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    
    updateStatus('camera-status', 'granted');
    showPreview('camera-preview', cameraStream);
    button.textContent = 'Camera Access Granted ✓';
    checkAllPermissions();
    
    console.log('Camera permission granted');
  } catch (err) {
    console.error('Camera permission denied:', err);
    updateStatus('camera-status', 'denied');
    button.disabled = false;
    button.textContent = 'Retry Camera Access';
    alert('Camera access denied. Please check your browser settings and try again.');
  }
}

// Request microphone permission
async function requestMicrophone() {
  const button = document.getElementById('request-microphone');
  button.disabled = true;
  button.textContent = 'Requesting...';

  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    
    updateStatus('microphone-status', 'granted');
    showPreview('microphone-preview', microphoneStream);
    button.textContent = 'Microphone Access Granted ✓';
    checkAllPermissions();
    
    console.log('Microphone permission granted');
  } catch (err) {
    console.error('Microphone permission denied:', err);
    updateStatus('microphone-status', 'denied');
    button.disabled = false;
    button.textContent = 'Retry Microphone Access';
    alert('Microphone access denied. Please check your browser settings and try again.');
  }
}

// Request both permissions at once
async function requestBoth() {
  const button = document.getElementById('request-both');
  button.disabled = true;
  button.textContent = 'Requesting Permissions...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    // Split the stream into camera and microphone
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    
    if (videoTracks.length > 0) {
      cameraStream = new MediaStream(videoTracks);
      updateStatus('camera-status', 'granted');
      showPreview('camera-preview', cameraStream);
      document.getElementById('request-camera').textContent = 'Camera Access Granted ✓';
      document.getElementById('request-camera').disabled = true;
    }
    
    if (audioTracks.length > 0) {
      microphoneStream = new MediaStream(audioTracks);
      updateStatus('microphone-status', 'granted');
      showPreview('microphone-preview', microphoneStream);
      document.getElementById('request-microphone').textContent = 'Microphone Access Granted ✓';
      document.getElementById('request-microphone').disabled = true;
    }
    
    button.textContent = 'All Permissions Granted ✓';
    checkAllPermissions();
    
    console.log('Camera and microphone permissions granted');
  } catch (err) {
    console.error('Permission denied:', err);
    button.disabled = false;
    button.textContent = 'Retry - Grant Camera & Microphone Access';
    alert('Media access denied. Please check your browser settings and try again.');
  }
}

// Check if all permissions are granted
function checkAllPermissions() {
  if (cameraStream && microphoneStream) {
    document.getElementById('success-message').classList.add('show');
  }
}

// Check existing permissions on load
async function checkExistingPermissions() {
  try {
    const permissions = await Promise.all([
      navigator.permissions.query({ name: 'camera' }),
      navigator.permissions.query({ name: 'microphone' })
    ]);
    
    const [cameraPermission, micPermission] = permissions;
    
    if (cameraPermission.state === 'granted') {
      // Auto-request to get the stream
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        updateStatus('camera-status', 'granted');
        showPreview('camera-preview', cameraStream);
        document.getElementById('request-camera').textContent = 'Camera Access Granted ✓';
        document.getElementById('request-camera').disabled = true;
      } catch (err) {
        console.error('Error getting camera stream:', err);
      }
    }
    
    if (micPermission.state === 'granted') {
      // Auto-request to get the stream
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        updateStatus('microphone-status', 'granted');
        showPreview('microphone-preview', microphoneStream);
        document.getElementById('request-microphone').textContent = 'Microphone Access Granted ✓';
        document.getElementById('request-microphone').disabled = true;
      } catch (err) {
        console.error('Error getting microphone stream:', err);
      }
    }
    
    checkAllPermissions();
  } catch (err) {
    console.error('Error checking permissions:', err);
  }
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('request-camera').addEventListener('click', requestCamera);
  document.getElementById('request-microphone').addEventListener('click', requestMicrophone);
  document.getElementById('request-both').addEventListener('click', requestBoth);
  
  // Check existing permissions
  checkExistingPermissions();
});

// Clean up streams when page closes
window.addEventListener('beforeunload', () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => track.stop());
  }
});

