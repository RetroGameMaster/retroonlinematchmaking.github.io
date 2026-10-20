// modules/submit-game/submit-game.js - COMPLETE FIXED VERSION WITH SLUGS & NEW METADATA
import { supabase, getCurrentUser } from '../../lib/supabase.js';

function initSubmitGame(rom, params = {}) {
  console.log('🎮 Initializing game submission form...');

  // Ensure we have supabase
  if (!rom.supabase) {
    if (window.supabase) {
      rom.supabase = window.supabase;
    } else {
      showResult('error', 'Database connection error. Please refresh the page.');
      return;
    }
  }

  // Check if user is logged in
  if (!rom.currentUser) {
    document.getElementById('loginPrompt').style.display = 'block';
    document.getElementById('submissionForm').style.display = 'none';
    return;
  } else {
    document.getElementById('loginPrompt').style.display = 'none';
    document.getElementById('submissionForm').style.display = 'block';
  }

  setupDecompSubmissionForm(rom);
  document.getElementById('console')?.addEventListener('change', event => {
    if (event.target.value === 'Decomps') {
      document.getElementById('decomp-submission-tab')?.click();
    }
  });
  if (params.tab === 'decomp') document.getElementById('decomp-submission-tab')?.click();

  let methodCount = 1;
  let selectedCoverImage = null;
  let selectedScreenshots = [];

  // Add new connection method
  document.getElementById('addMethodBtn').addEventListener('click', function () {
    const methodsContainer = document.getElementById('connectionMethods');
    const newMethod = document.createElement('div');
    newMethod.className = 'connection-method fade-in';
    newMethod.setAttribute('data-index', methodCount);
    
    newMethod.innerHTML = `
      <div class="method-header">
        <span class="method-number">Connection Method #${methodCount + 1}</span>
        <button type="button" class="remove-method-btn" onclick="removeConnectionMethod(this)">
          ✕ Remove
        </button>
      </div>
      <div class="form-group">
        <label class="form-label required">Method Name</label>
        <input type="text" class="form-input" name="methodName" required 
               placeholder="e.g., XLink Kai, PSONE, DNS Server">
      </div>
     
      <div class="form-group">
        <label class="form-label">Connection Type</label>
        <select class="form-select" name="connectionType">
          <option value="dns">DNS Server</option>
          <option value="community">Community Server</option>
          <option value="vpn">VPN/LAN Tunnel</option>
          <option value="emulator">Emulator Network</option>
          <option value="official">Official Servers</option>
          <option value="other">Other</option>
        </select>
      </div>
     
      <div class="form-group">
        <label class="form-label">Instructions/Setup Guide</label>
        <textarea class="form-textarea" name="instructions" rows="3"
                  placeholder="Brief setup instructions or link to guide..."></textarea>
      </div>
     
      <div class="form-group">
        <label class="form-label">DNS/Server Address (if applicable)</label>
        <input type="text" class="form-input" name="serverAddress"
               placeholder="e.g., 123.456.789.012">
      </div>
    `;
    
    methodsContainer.appendChild(newMethod);
    methodCount++;
    
    const firstMethod = document.querySelector('.connection-method[data-index="0"] .remove-method-btn');
    if (firstMethod && firstMethod.style.display === 'none') {
      firstMethod.style.display = 'block';
    }
  });

  // Add image upload section
  addImageUploadSection();

  // Handle form submission
  document.getElementById('gameSubmissionForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!rom.currentUser) {
      showResult('error', 'Please log in to submit a game');
      rom.loadModule('auth');
      return;
    }
    
    // Validate required fields
    const gameTitle = document.getElementById('gameTitle').value.trim();
    const description = document.getElementById('description').value.trim();
    const maxPlayers = document.getElementById('maxPlayers').value;
    const genre = document.getElementById('genre').selectedOptions;
    const consoleSelect = document.getElementById("console");

    if (consoleSelect.value === 'Decomps') {
      document.getElementById('decomp-submission-tab')?.click();
      return;
    }
    
    if (!consoleSelect.value) {
      showResult('error', 'Please select a system/console');
      return;
    }
    
    if (!description) {
      showResult('error', 'Description is required');
      return;
    }
    
    if (!maxPlayers || maxPlayers < 2 || maxPlayers > 256) {
      showResult('error', 'Please enter a valid number of maximum players (2-256)');
      return;
    }
    
    if (genre.length === 0) {
      showResult('error', 'Please select at least one genre');
      return;
    }
    
    // Check connection methods
    const methodNames = document.querySelectorAll('[name="methodName"]');
    let hasValidMethod = false;
    methodNames.forEach(input => {
      if (input.value.trim()) hasValidMethod = true;
    });
    
    if (!hasValidMethod) {
      showResult('error', 'Please add at least one connection method');
      return;
    }
    
    // Check cover image
    if (!selectedCoverImage) {
      showResult('error', 'Cover image is required');
      return;
    }
    
    // Collect form data (Including New Metadata Fields)
    const gameData = {
      title: gameTitle,
      releaseYear: document.getElementById('releaseYear').value || null,
      description: description,
      maxPlayers: parseInt(maxPlayers),
      genre: Array.from(genre).map(opt => opt.value),
      console: consoleSelect.value,
      
      // --- NEW METADATA FIELDS ---
      developer: document.getElementById('developer')?.value.trim() || null,
      publisher: document.getElementById('publisher')?.value.trim() || null,
      releaseDate: document.getElementById('releaseDate')?.value || null,
      features: document.getElementById('features')?.value.trim() ? 
                 document.getElementById('features').value.split(',').map(f => f.trim()).filter(f => f) : [],
      videoUrl: document.getElementById('videoUrl')?.value.trim() || null,
      backgroundVideoUrl: document.getElementById('backgroundVideoUrl')?.value.trim() || null,
      // ---------------------------

      communityLink: document.getElementById('communityLink').value.trim() || null,
      submitterContact: document.getElementById('submitterContact').value.trim() || null,
      additionalNotes: document.getElementById('additionalNotes').value.trim() || null,
      submittedBy: rom.currentUser.email,
      submittedByUserId: rom.currentUser.id,
      submittedAt: new Date().toISOString(),
      status: 'pending'
    };
    
    // Generate slug
    gameData.slug = generateSlug(gameData.title);
    
    // Collect connection methods
    const methods = [];
    document.querySelectorAll('.connection-method').forEach((methodDiv, index) => {
      const methodName = methodDiv.querySelector('[name="methodName"]').value.trim();
      if (!methodName) return;
      const methodData = {
        name: methodName,
        type: methodDiv.querySelector('[name="connectionType"]').value,
        instructions: methodDiv.querySelector('[name="instructions"]').value.trim() || null,
        serverAddress: methodDiv.querySelector('[name="serverAddress"]').value.trim() || null,
        order: index
      };
      methods.push(methodData);
    });
    gameData.connectionMethods = methods;
    
    // Validate
    const validation = validateSubmission(gameData, methods);
    if (!validation.valid) {
      showResult('error', validation.message);
      return;
    }
    
    // Show loading
    const submitBtn = document.getElementById('submitButton');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    
    try {
      // Save the game submission
      const result = await saveGameSubmission(gameData, rom.supabase);
      
      // Upload images
      if (selectedCoverImage || selectedScreenshots.length > 0) {
        await uploadSubmissionImages(result.id, selectedCoverImage, selectedScreenshots, rom.supabase);
      }
      
      showResult('success', `
        🎉 Game submitted successfully!
        
        <strong>"${gameData.title}"</strong> has been sent for admin review.
        You'll be notified when it's approved or if we need more information.
        
        Submission ID: ${result.id}<br>
        Submitted: ${new Date().toLocaleDateString()}
        
        Thank you for contributing to the ROM community!
      `);
      
      setTimeout(() => {
        resetForm();
        methodCount = 1;
        selectedCoverImage = null;
        selectedScreenshots = [];
      }, 5000);
      
    } catch (error) {
      console.error('Submission failed:', error);
      showResult('error', `Submission failed: ${error.message}`);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  // IMAGE UPLOAD FUNCTIONS
  function addImageUploadSection() {
    const basicInfoSection = document.querySelector('.form-section');
    if (!basicInfoSection) return;
    
    const imageHTML = `
      <div class="form-section fade-in">
        <h3>🖼️ Game Images</h3>
        <p class="text-gray-400 text-sm mb-4">Upload cover art (required) and up to 3 screenshots (optional)</p>
       
        <!-- Cover Art Upload -->
        <div class="mb-6">
          <label class="form-label required">Cover Art *</label>
          <div class="file-upload-area bg-gray-900 border-2 border-dashed border-gray-600 rounded-lg p-6 text-center mb-4 cursor-pointer hover:border-cyan-500 transition-colors"
               id="coverUploadArea">
            <div class="mb-4">
              <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
            </div>
            <p class="text-gray-300 mb-2">Drag & drop or click to upload cover art</p>
            <button type="button" onclick="document.getElementById('coverImage').click()" 
                    class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded mt-2">
              Choose File
            </button>
            <p class="text-gray-400 text-xs mt-2">PNG, JPG up to 2MB</p>
            <input type="file" id="coverImage" accept="image/*" class="hidden">
            <input type="hidden" id="coverImageRequired" value="false">
          </div>
         
          <div id="coverPreview" class="hidden">
            <p class="text-gray-300 mb-2">Preview:</p>
            <div class="flex items-center gap-4">
              <img id="coverPreviewImg" class="w-32 h-48 object-cover rounded border border-cyan-500">
              <button type="button" onclick="removeCoverImage()" 
                      class="text-red-400 hover:text-red-300">✕ Remove</button>
            </div>
          </div>
          <div id="coverError" class="text-red-400 text-sm mt-2 hidden">Cover image is required</div>
        </div>
       
        <!-- Screenshots Upload -->
        <div>
          <label class="form-label">Screenshots (Optional, max 3)</label>
          <div class="file-upload-area bg-gray-900 border-2 border-dashed border-gray-600 rounded-lg p-6 text-center mb-4 cursor-pointer hover:border-purple-500 transition-colors"
               id="screenshotsUploadArea">
            <div class="mb-4">
              <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
            <p class="text-gray-300 mb-2">Drag & drop or click to upload screenshots</p>
            <button type="button" onclick="document.getElementById('screenshotImages').click()" 
                    class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded mt-2">
              Choose Files
            </button>
            <p class="text-gray-400 text-xs mt-2">PNG, JPG up to 2MB each (max 3 files)</p>
            <input type="file" id="screenshotImages" accept="image/*" multiple class="hidden">
          </div>
         
          <div id="screenshotsPreview" class="grid grid-cols-3 gap-4 mt-4"></div>
        </div>
      </div>
    `;
    
    basicInfoSection.insertAdjacentHTML('afterend', imageHTML);
    
    setTimeout(() => {
      initImageUploadListeners();
    }, 100);
  }

  function initImageUploadListeners() {
    const coverUploadArea = document.getElementById('coverUploadArea');
    const coverImageInput = document.getElementById('coverImage');
    
    if (coverUploadArea && coverImageInput) {
      coverUploadArea.addEventListener('click', () => coverImageInput.click());
      coverUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        coverUploadArea.classList.add('dragover');
      });
      coverUploadArea.addEventListener('dragleave', () => {
        coverUploadArea.classList.remove('dragover');
      });
      coverUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        coverUploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          handleCoverImageUpload(e.dataTransfer.files[0]);
        }
      });
      
      coverImageInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          handleCoverImageUpload(e.target.files[0]);
        }
      });
    }
    
    const screenshotsUploadArea = document.getElementById('screenshotsUploadArea');
    const screenshotsInput = document.getElementById('screenshotImages');
    
    if (screenshotsUploadArea && screenshotsInput) {
      screenshotsUploadArea.addEventListener('click', () => screenshotsInput.click());
      screenshotsUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        screenshotsUploadArea.classList.add('dragover');
      });
      screenshotsUploadArea.addEventListener('dragleave', () => {
        screenshotsUploadArea.classList.remove('dragover');
      });
      screenshotsUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        screenshotsUploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          handleScreenshotsUpload(Array.from(e.dataTransfer.files));
        }
      });
      
      screenshotsInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          handleScreenshotsUpload(Array.from(e.target.files));
        }
      });
    }
    
    window.removeCoverImage = function() {
      selectedCoverImage = null;
      document.getElementById('coverPreview').classList.add('hidden');
      document.getElementById('coverImage').value = '';
      document.getElementById('coverImageRequired').value = 'false';
      const coverError = document.getElementById('coverError');
      if (coverError) coverError.classList.remove('hidden');
    };
    
    window.removeScreenshot = function(index) {
      selectedScreenshots.splice(index, 1);
      updateScreenshotsPreview();
    };
  }

  function handleCoverImageUpload(file) {
    if (!file.type.startsWith('image/')) {
      showResult('error', 'Please select an image file (PNG, JPG)');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      showResult('error', 'Image must be less than 2MB');
      return;
    }
    
    const preview = document.getElementById('coverPreview');
    const previewImg = document.getElementById('coverPreviewImg');
    const reader = new FileReader();
    
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      preview.classList.remove('hidden');
      const coverError = document.getElementById('coverError');
      if (coverError) coverError.classList.add('hidden');
      selectedCoverImage = file;
      document.getElementById('coverImageRequired').value = 'true';
    };
    reader.readAsDataURL(file);
  }

  function handleScreenshotsUpload(files) {
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        showResult('error', 'Only image files are allowed for screenshots');
        return false;
      }
      if (file.size > 2 * 1024 * 1024) {
        showResult('error', 'Screenshot must be less than 2MB');
        return false;
      }
      return true;
    });
    
    const remainingSlots = 3 - selectedScreenshots.length;
    const filesToAdd = validFiles.slice(0, remainingSlots);
    
    if (filesToAdd.length < validFiles.length) {
      showResult('error', `Only ${remainingSlots} more screenshot(s) allowed (max 3 total)`);
    }
    
    selectedScreenshots.push(...filesToAdd);
    updateScreenshotsPreview();
  }

  function updateScreenshotsPreview() {
    const container = document.getElementById('screenshotsPreview');
    if (!container) return;
    
    container.innerHTML = '';
    
    selectedScreenshots.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const div = document.createElement('div');
        div.className = 'relative';
        div.innerHTML = `
          <img src="${e.target.result}" alt="Screenshot ${index + 1}" 
               class="w-full h-32 object-cover rounded-lg border border-gray-600">
          <button type="button" onclick="removeScreenshot(${index})" 
                  class="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 rounded-full">✕</button>
        `;
        container.appendChild(div);
      };
      reader.readAsDataURL(file);
    });
  }

  function validateSubmission(gameData, methods) {
    if (!gameData.title || gameData.title.length < 2) {
      return { valid: false, message: 'Game title must be at least 2 characters' };
    }
    
    if (!gameData.description || gameData.description.length < 20) {
      return { valid: false, message: 'Description must be at least 20 characters' };
    }
    
    if (!selectedCoverImage) {
      return { valid: false, message: 'Cover image is required' };
    }
    
    if (methods.length === 0) {
      return { valid: false, message: 'At least one connection method is required' };
    }
    
    for (const method of methods) {
      if (!method.name || method.name.length < 2) {
        return { valid: false, message: 'Connection method name is required' };
      }
    }
    
    return { valid: true, message: 'Validation passed' };
  }

  function generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }

  async function saveGameSubmission(gameData, supabaseClient) {
    const submissionData = {
      title: gameData.title,
      console: gameData.console,
      year: gameData.releaseYear ? parseInt(gameData.releaseYear) : null,
      description: gameData.description,
      notes: gameData.additionalNotes || null,
      user_id: gameData.submittedByUserId,
      user_email: gameData.submittedBy,
      connection_method: gameData.connectionMethods.map(m => m.name).join(', '),
      connection_details: JSON.stringify(gameData.connectionMethods),
      multiplayer_type: 'Online',
      players_min: 1,
      players_max: parseInt(gameData.maxPlayers),
      servers_available: gameData.connectionMethods.some(m => m.serverAddress) ? true : false,
      server_details: gameData.connectionMethods.filter(m => m.serverAddress).map(m => m.serverAddress).join(', '),
      status: 'pending',
      screenshot_urls: [],
      created_at: new Date().toISOString(),
      
      // --- NEW METADATA FIELDS FOR DB ---
      developer: gameData.developer,
      publisher: gameData.publisher,
      genre: gameData.genre.join(', '), // Store as comma-separated string for now
      release_date: gameData.releaseDate,
      features: gameData.features, // Store as array if column is text[], else join
      video_url: gameData.videoUrl,
      background_video_url: gameData.backgroundVideoUrl
      // ----------------------------------
    };
    
    const { data, error } = await supabaseClient
      .from('game_submissions')
      .insert([submissionData])
      .select();
    
    if (error) {
      console.error('❌ Supabase error:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    return data[0];
  }

  async function uploadSubmissionImages(submissionId, coverImage, screenshots, supabaseClient) {
    try {
      const screenshotUrls = [];
      
      if (coverImage) {
        const fileExt = coverImage.name.split('.').pop();
        const fileName = `submissions/${submissionId}/cover-${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabaseClient.storage
          .from('game-images')
          .upload(fileName, coverImage, {
            cacheControl: '3600',
            upsert: true
          });
        
        if (error) {
          console.error('Cover upload error:', error);
          throw error;
        }
        
        const publicUrl = `https://lapyxhothazalssrbimb.supabase.co/storage/v1/object/public/game-images/${fileName}`;
        
        const { error: updateError } = await supabaseClient
          .from('game_submissions')
          .update({ 
            file_url: publicUrl,
            cover_image_url: publicUrl
          })
          .eq('id', submissionId);
        
        if (updateError) {
          console.warn('Could not update submission with cover URL:', updateError);
        }
      }
      
      if (screenshots.length > 0) {
        for (let i = 0; i < screenshots.length && i < 3; i++) {
          const screenshot = screenshots[i];
          const fileExt = screenshot.name.split('.').pop();
          const fileName = `submissions/${submissionId}/screenshot-${Date.now()}-${i}.${fileExt}`;
          
          const { data, error } = await supabaseClient.storage
            .from('game-images')
            .upload(fileName, screenshot, {
              cacheControl: '3600',
              upsert: true
            });
          
          if (error) {
            console.warn('Failed to upload screenshot:', error);
            continue;
          }
          
          const publicUrl = `https://lapyxhothazalssrbimb.supabase.co/storage/v1/object/public/game-images/${fileName}`;
          screenshotUrls.push(publicUrl);
        }
        
        if (screenshotUrls.length > 0) {
          const { error: updateError } = await supabaseClient
            .from('game_submissions')
            .update({ screenshot_urls: screenshotUrls })
            .eq('id', submissionId);
          
          if (updateError) {
            console.warn('Could not update submission with screenshot URLs:', updateError);
          }
        }
      }
      
    } catch (error) {
      console.error('Error uploading images:', error);
    }
  }

  function showResult(type, message) {
    const resultDiv = document.getElementById('submitResult');
    resultDiv.className = type === 'success' ? 'success-message' : 'error-message';
    resultDiv.innerHTML = message.replace(/\n/g, '<br>');
    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
    
    setTimeout(() => {
      if (resultDiv.style.display === 'block') {
        resultDiv.style.display = 'none';
      }
    }, type === 'success' ? 15000 : 10000);
  }

  function resetForm() {
    document.getElementById('gameSubmissionForm').reset();
    
    const connectionMethods = document.getElementById('connectionMethods');
    if (connectionMethods) {
      connectionMethods.innerHTML = `
        <div class="connection-method" data-index="0">
          <div class="method-header">
            <span class="method-number">Connection Method #1</span>
            <button type="button" class="remove-method-btn" onclick="removeConnectionMethod(this)" style="display: none;">
              ✕ Remove
            </button>
          </div>
          <div class="form-group">
            <label class="form-label required">Method Name</label>
            <input type="text" class="form-input" name="methodName" required 
                   placeholder="e.g., XLink Kai, PSONE, DNS Server">
          </div>
         
          <div class="form-group">
            <label class="form-label">Connection Type</label>
            <select class="form-select" name="connectionType">
              <option value="dns">DNS Server</option>
              <option value="community">Community Server</option>
              <option value="vpn">VPN/LAN Tunnel</option>
              <option value="emulator">Emulator Network</option>
              <option value="official">Official Servers</option>
              <option value="other">Other</option>
            </select>
          </div>
         
          <div class="form-group">
            <label class="form-label">Instructions/Setup Guide</label>
            <textarea class="form-textarea" name="instructions" rows="3"
                      placeholder="Brief setup instructions or link to guide..."></textarea>
          </div>
         
          <div class="form-group">
            <label class="form-label">DNS/Server Address (if applicable)</label>
            <input type="text" class="form-input" name="serverAddress"
                   placeholder="e.g., 123.456.789.012">
          </div>
        </div>
      `;
    }
    
    if (document.getElementById('coverPreview')) {
      document.getElementById('coverPreview').classList.add('hidden');
      document.getElementById('coverImage').value = '';
    }
    
    if (document.getElementById('screenshotsPreview')) {
      document.getElementById('screenshotsPreview').innerHTML = '';
      document.getElementById('screenshotImages').value = '';
    }
    
    document.getElementById('submitResult').style.display = 'none';
    
    methodCount = 1;
    selectedCoverImage = null;
    selectedScreenshots = [];
  }

  window.removeConnectionMethod = function(button) {
    const methodDiv = button.closest('.connection-method');
    if (methodDiv) {
      methodDiv.remove();
      updateMethodNumbers();
      const remainingMethods = document.querySelectorAll('.connection-method');
      if (remainingMethods.length === 1) {
        const firstMethodBtn = remainingMethods[0].querySelector('.remove-method-btn');
        if (firstMethodBtn) {
          firstMethodBtn.style.display = 'none';
        }
      }
    }
  };

  function updateMethodNumbers() {
    const methods = document.querySelectorAll('.connection-method');
    methods.forEach((method, index) => {
      const numberSpan = method.querySelector('.method-number');
      if (numberSpan) {
        numberSpan.textContent = `Connection Method #${index + 1}`;
      }
      method.setAttribute('data-index', index);
    });
    methodCount = methods.length;
  }
}

function setupDecompSubmissionForm(rom) {
  const standardTab = document.getElementById('standard-submission-tab');
  const decompTab = document.getElementById('decomp-submission-tab');
  const standardPanel = document.getElementById('standard-submission-panel');
  const decompPanel = document.getElementById('decomp-submission-panel');
  const githubInput = document.getElementById('decomp-github-url');
  const youtubeInput = document.getElementById('decomp-youtube-url');
  const result = document.getElementById('decomp-submit-result');
  const form = document.getElementById('decompSubmissionForm');
  if (!standardTab || !decompTab || !standardPanel || !decompPanel || !form) return;

  const showTab = (tab) => {
    const decompActive = tab === 'decomp';
    standardPanel.classList.toggle('hidden', decompActive);
    decompPanel.classList.toggle('hidden', !decompActive);
    standardTab.className = `rounded-lg px-4 py-3 text-sm font-bold ${decompActive ? 'text-gray-300 hover:bg-gray-800' : 'bg-cyan-700 text-white'}`;
    decompTab.className = `rounded-lg px-4 py-3 text-sm font-bold ${decompActive ? 'bg-purple-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`;
  };
  standardTab.addEventListener('click', () => showTab('standard'));
  decompTab.addEventListener('click', () => showTab('decomp'));

  let githubPreviewTimer;
  githubInput?.addEventListener('input', () => {
    clearTimeout(githubPreviewTimer);
    githubPreviewTimer = setTimeout(() => void renderGitHubSubmissionPreview(githubInput.value), 400);
  });
  youtubeInput?.addEventListener('input', () => renderYouTubeSubmissionPreview(youtubeInput.value));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!rom.currentUser) {
      showDecompResult('error', 'Please sign in before submitting a project.');
      return;
    }

    const title = document.getElementById('decomp-title').value.trim();
    const description = document.getElementById('decomp-description').value.trim();
    const githubUrl = normalizeGitHubRepositoryUrl(githubInput?.value);
    const youtubeUrl = normalizeYouTubeUrl(youtubeInput?.value);
    if (!githubUrl) {
      showDecompResult('error', 'Enter a public GitHub repository URL such as https://github.com/owner/project.');
      githubInput?.focus();
      return;
    }
    if (youtubeInput?.value.trim() && !youtubeUrl) {
      showDecompResult('error', 'The optional video must be a valid YouTube video URL.');
      youtubeInput.focus();
      return;
    }
    if (title.length < 2 || description.length < 20) {
      showDecompResult('error', 'Add a project title and a description of at least 20 characters.');
      return;
    }

    const button = document.getElementById('decomp-submit-button');
    button.disabled = true;
    button.textContent = 'Submitting…';
    try {
      const { error } = await rom.supabase.from('game_submissions').insert({
        title,
        console: 'Decomps',
        year: null,
        description,
        notes: document.getElementById('decomp-contact').value.trim() || null,
        user_id: rom.currentUser.id,
        user_email: rom.currentUser.email,
        connection_method: 'Decomp project repository',
        connection_details: JSON.stringify({ github_url: githubUrl, youtube_url: youtubeUrl }),
        multiplayer_type: document.getElementById('decomp-multiplayer').value,
        players_min: 1,
        players_max: 1,
        servers_available: false,
        server_details: null,
        status: 'pending',
        screenshot_urls: [],
        genre: 'Recomps',
        github_url: githubUrl,
        youtube_url: youtubeUrl,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;

      form.reset();
      document.getElementById('decomp-github-preview').textContent = 'A GitHub repository preview appears after you enter a valid project link.';
      document.getElementById('decomp-youtube-preview').classList.add('hidden');
      showDecompResult('success', 'Project submitted! It will appear in the Decomp review queue after admin approval.');
    } catch (error) {
      console.error('Decomp project submission failed:', error);
      showDecompResult('error', `Could not submit this project: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = 'Submit Decomp project for review';
    }
  });

  function showDecompResult(type, message) {
    if (!result) return;
    result.className = `rounded-lg border p-3 text-sm ${type === 'success' ? 'border-green-700 bg-green-950/40 text-green-200' : 'border-red-700 bg-red-950/40 text-red-200'}`;
    result.textContent = message;
    result.classList.remove('hidden');
  }
}

function normalizeGitHubRepositoryUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl.trim());
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || parts.length < 2) return '';
    if (!/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) return '';
    return `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/i, '')}`;
  } catch {
    return '';
  }
}

function normalizeYouTubeUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) return '';
    const videoId = host === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    return videoId && /^[\w-]{11}$/.test(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : '';
  } catch {
    return '';
  }
}

function youtubeEmbedSource(rawUrl) {
  const safeUrl = normalizeYouTubeUrl(rawUrl);
  if (!safeUrl) return '';
  const videoId = new URL(safeUrl).searchParams.get('v');
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

async function renderGitHubSubmissionPreview(rawUrl) {
  const preview = document.getElementById('decomp-github-preview');
  if (!preview) return;
  const repositoryUrl = normalizeGitHubRepositoryUrl(rawUrl);
  if (!repositoryUrl) {
    preview.textContent = 'Enter a valid public GitHub repository URL to preview the project.';
    return;
  }
  const [, owner, repository] = new URL(repositoryUrl).pathname.split('/');
  preview.innerHTML = `<a href="${repositoryUrl}" target="_blank" rel="noopener noreferrer" class="font-bold text-cyan-300 hover:underline">🐙 ${owner}/${repository}</a><p class="mt-2 text-xs text-gray-500">Loading repository preview…</p>`;
  try {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const repo = await response.json();
    preview.innerHTML = `<a href="${repositoryUrl}" target="_blank" rel="noopener noreferrer" class="font-bold text-cyan-300 hover:underline">🐙 ${escapeMarkup(repo.full_name)}</a><p class="mt-2 text-sm text-gray-300">${escapeMarkup(repo.description || 'No repository description.')}</p><p class="mt-2 text-xs text-gray-500">${escapeMarkup(repo.language || 'Language not listed')} · ★ ${Number(repo.stargazers_count || 0).toLocaleString()} · ${repo.archived ? 'Archived repository' : 'Active repository'}</p>`;
  } catch (error) {
    console.warn('GitHub submission preview unavailable:', error);
    preview.innerHTML = `<a href="${repositoryUrl}" target="_blank" rel="noopener noreferrer" class="font-bold text-cyan-300 hover:underline">🐙 ${owner}/${repository}</a><p class="mt-2 text-xs text-amber-300">Could not load repository details. The link is restricted to github.com; check it directly.</p>`;
  }
}

function renderYouTubeSubmissionPreview(rawUrl) {
  const preview = document.getElementById('decomp-youtube-preview');
  if (!preview) return;
  const source = youtubeEmbedSource(rawUrl);
  if (!source) {
    preview.replaceChildren();
    if (rawUrl?.trim()) {
      preview.textContent = 'Enter a valid YouTube video link for an embedded preview.';
      preview.classList.remove('hidden');
    } else {
      preview.classList.add('hidden');
    }
    return;
  }
  preview.innerHTML = `<iframe src="${source}" title="Decomp project YouTube preview" class="aspect-video w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  preview.classList.remove('hidden');
}

function escapeMarkup(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

export default initSubmitGame;
