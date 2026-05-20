document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('video-url');
  const btnPaste = document.getElementById('btn-paste');
  const btnDownload = document.getElementById('btn-download');
  
  // UI Containers & Cards
  const downloaderCard = document.querySelector('.downloader-card');
  const loadingState = document.getElementById('loading-state');
  const errorCard = document.getElementById('error-card');
  const errorTitle = document.getElementById('error-title');
  const errorText = document.getElementById('error-text');
  const resultCard = document.getElementById('result-card');
  const filterIndicator = document.getElementById('filter-indicator');
  const indicatorText = document.getElementById('indicator-text');
  
  // Tabs
  const tabItems = document.querySelectorAll('.tab-item');
  let activePlatform = 'all'; // 'all' | 'youtube' | 'instagram' | 'tiktok'

  // Result Details Elements
  const videoThumb = document.getElementById('video-thumb');
  const platformBadge = document.getElementById('platform-badge');
  const videoDuration = document.getElementById('video-duration');
  const videoTitle = document.getElementById('video-title');
  const videoAuthor = document.getElementById('video-author');
  const optionsContainer = document.getElementById('options-container');

  // Regex patterns to detect platforms
  const patterns = {
    youtube: /(youtube\.com|youtu\.be)/i,
    instagram: /instagram\.com/i,
    tiktok: /tiktok\.com/i
  };

  // Placeholders for each tab state
  const placeholders = {
    all: '',
    youtube: '',
    instagram: '',
    tiktok: ''
  };

  const translations = {
    tr: {
      docTitle: "SaveStream | Premium Video & Audio Downloader",
      headerTagline: "Premium Medya Portalı",
      welcomeTitle: 'Sosyal Medya <span class="gradient-text">İndirici</span>',
      welcomeSubtitle: "YouTube, Instagram ve TikTok bağlantılarını girin. Videoları anında en yüksek kalitede cihazınıza kaydedin.",
      tabAll: "Otomatik Tespit",
      tabYoutube: "YouTube",
      tabInstagram: "Instagram",
      tabTiktok: "TikTok",
      inputPlaceholderAll: "Video veya Reel bağlantısını buraya yapıştırın...",
      inputPlaceholderYoutube: "YouTube video veya şort bağlantısını yapıştırın...",
      inputPlaceholderInstagram: "Instagram Reels veya gönderi bağlantısını yapıştırın...",
      inputPlaceholderTiktok: "TikTok video bağlantısını yapıştırın...",
      btnPaste: '<i class="fa-regular fa-clipboard"></i> Yapıştır',
      btnPasteSuccess: '<i class="fa-solid fa-check"></i> Yapıştırıldı',
      btnDownload: '<span>Video Sorgula</span> <i class="fa-solid fa-wand-magic-sparkles"></i>',
      btnDownloadQuerying: '<span>Sorgulanıyor...</span> <i class="fa-solid fa-spinner fa-spin"></i>',
      btnDownloadQuery: '<span>Sorgula</span> <i class="fa-solid fa-wand-magic-sparkles"></i>',
      errYoutubeOnly: 'Yalnızca YouTube bağlantıları kabul edilir.',
      errInstagramOnly: 'Yalnızca Instagram Reels ve gönderi bağlantıları kabul edilir.',
      errTiktokOnly: 'Yalnızca TikTok bağlantıları kabul edilir.',
      clipboardUnsupported: 'Tarayıcınız pano erişimini desteklemiyor. Lütfen bağlantıyı manuel olarak yapıştırın.',
      clipboardPermissionDenied: 'Pano okuma izni reddedildi. Lütfen Ctrl+V kullanarak manuel yapıştırın.',
      errorTitleMissing: 'Bağlantı Eksik',
      errorTextMissing: 'Lütfen indirmek istediğiniz videonun URL adresini girin.',
      errorTitleMismatch: 'Uyumsuz Bağlantı',
      errorTextMismatch: 'Girdiğiniz bağlantı seçtiğiniz filtre seçeneğiyle eşleşmiyor.',
      errorTitleQuery: 'Sorgu Hatası',
      errorTitleConnection: 'Bağlantı Hatası',
      errorTextConnection: 'Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun.',
      downloadOptionsHeader: 'İndirme Seçenekleri (HD Kalite)',
      untitledMedia: 'Başlıksız Medya',
      unknownCreator: 'Bilinmeyen Üretici',
      noDownloadOptions: 'İndirme seçeneği bulunamadı.',
      btnDownloadAction: 'İndir',
      btnDownloadStarting: 'Başlatılıyor...',
      btnDownloadFailed: 'İndirme başlatılamadı.',
      btnDownloadingAction: 'İndiriliyor...',
      btnMergingAction: 'Birleştiriliyor...',
      btnCompletedAction: 'Tamamlandı!',
      btnFailedAction: 'Hata Oluştu!',
      aboutModalTitle: 'Hakkımızda',
      privacyModalTitle: 'Gizlilik Politikası',
      linkAbout: 'Hakkımızda',
      linkPrivacy: 'Gizlilik Politikası',
      footerText: '© 2026 SaveStream. Tüm hakları saklıdır. Bu site eğitim ve kişisel kullanım için tasarlanmıştır.'
    },
    en: {
      docTitle: "SaveStream | Premium Video & Audio Downloader",
      headerTagline: "Premium Media Portal",
      welcomeTitle: 'Social Media <span class="gradient-text">Downloader</span>',
      welcomeSubtitle: "Enter YouTube, Instagram, or TikTok links. Instantly save videos to your device in highest quality.",
      tabAll: "Auto Detect",
      tabYoutube: "YouTube",
      tabInstagram: "Instagram",
      tabTiktok: "TikTok",
      inputPlaceholderAll: "Paste video or reel link here...",
      inputPlaceholderYoutube: "Paste YouTube video or short link...",
      inputPlaceholderInstagram: "Paste Instagram Reels or post link...",
      inputPlaceholderTiktok: "Paste TikTok video link...",
      btnPaste: '<i class="fa-regular fa-clipboard"></i> Paste',
      btnPasteSuccess: '<i class="fa-solid fa-check"></i> Pasted',
      btnDownload: '<span>Query Video</span> <i class="fa-solid fa-wand-magic-sparkles"></i>',
      btnDownloadQuerying: '<span>Querying...</span> <i class="fa-solid fa-spinner fa-spin"></i>',
      btnDownloadQuery: '<span>Query</span> <i class="fa-solid fa-wand-magic-sparkles"></i>',
      errYoutubeOnly: 'Only YouTube links are accepted.',
      errInstagramOnly: 'Only Instagram Reels and post links are accepted.',
      errTiktokOnly: 'Only TikTok links are accepted.',
      clipboardUnsupported: 'Your browser does not support clipboard access. Please paste manually.',
      clipboardPermissionDenied: 'Clipboard permission denied. Please paste manually using Ctrl+V.',
      errorTitleMissing: 'Link Missing',
      errorTextMissing: 'Please enter the URL of the video you want to download.',
      errorTitleMismatch: 'Incompatible Link',
      errorTextMismatch: 'The link you entered does not match your selected filter.',
      errorTitleQuery: 'Query Error',
      errorTitleConnection: 'Connection Error',
      errorTextConnection: 'Could not connect to the server. Please ensure the server is running.',
      downloadOptionsHeader: 'Download Options (HD Quality)',
      untitledMedia: 'Untitled Media',
      unknownCreator: 'Unknown Creator',
      noDownloadOptions: 'No download options found.',
      btnDownloadAction: 'Download',
      btnDownloadStarting: 'Starting...',
      btnDownloadFailed: 'Could not start download.',
      btnDownloadingAction: 'Downloading...',
      btnMergingAction: 'Merging...',
      btnCompletedAction: 'Completed!',
      btnFailedAction: 'Error Occurred!',
      aboutModalTitle: 'About SaveStream',
      privacyModalTitle: 'Privacy Policy',
      linkAbout: 'About Us',
      linkPrivacy: 'Privacy Policy',
      footerText: '© 2026 SaveStream. All rights reserved. Designed for educational and personal use.'
    }
  };

  let currentLang = 'en';

  const setLanguage = (lang) => {
    currentLang = lang;
    
    // Update active button state
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`btn-lang-${lang}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update document title & metadata
    document.title = translations[lang].docTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', lang === 'tr' ? 
        "YouTube, Instagram ve TikTok videolarını filigransız, yüksek hızda ve tamamen ücretsiz olarak indirin." : 
        "Download YouTube, Instagram, and TikTok videos without watermarks, at high speeds and completely for free."
      );
    }

    // Update static HTML texts
    document.querySelector('.header-tagline').textContent = translations[lang].headerTagline;
    document.querySelector('.welcome-section h1').innerHTML = translations[lang].welcomeTitle;
    document.querySelector('.welcome-section p').textContent = translations[lang].welcomeSubtitle;
    
    document.querySelector('#tab-all span').textContent = translations[lang].tabAll;
    document.querySelector('#tab-youtube span').textContent = translations[lang].tabYoutube;
    document.querySelector('#tab-instagram span').textContent = translations[lang].tabInstagram;
    document.querySelector('#tab-tiktok span').textContent = translations[lang].tabTiktok;

    // Update input placeholders
    placeholders.all = translations[lang].inputPlaceholderAll;
    placeholders.youtube = translations[lang].inputPlaceholderYoutube;
    placeholders.instagram = translations[lang].inputPlaceholderInstagram;
    placeholders.tiktok = translations[lang].inputPlaceholderTiktok;

    // If input is empty, update placeholder immediately
    if (!urlInput.value.trim()) {
      urlInput.placeholder = placeholders[activePlatform];
    }

    // Update Paste button text if not in success state
    if (!btnPaste.classList.contains('success-state')) {
      btnPaste.innerHTML = translations[lang].btnPaste;
    }

    // Update download button text if not query-active
    if (!btnDownload.disabled) {
      btnDownload.innerHTML = translations[lang].btnDownload;
    } else {
      btnDownload.innerHTML = translations[lang].btnDownloadQuerying;
    }

    // Update footer
    document.querySelector('.footer p').textContent = translations[lang].footerText;
    document.getElementById('link-about').textContent = translations[lang].linkAbout;
    document.getElementById('link-privacy').textContent = translations[lang].linkPrivacy;

    // Update modal titles
    document.getElementById('modal-about-title').textContent = translations[lang].aboutModalTitle;
    document.getElementById('modal-privacy-title').textContent = translations[lang].privacyModalTitle;

    // Update modal body content visibility
    document.querySelectorAll('.lang-section-en').forEach(el => {
      el.style.display = lang === 'en' ? 'block' : 'none';
    });
    document.querySelectorAll('.lang-section-tr').forEach(el => {
      el.style.display = lang === 'tr' ? 'block' : 'none';
    });

    // Update result options heading if card is visible
    const optHeader = document.getElementById('download-section-title');
    if (optHeader) {
      optHeader.textContent = translations[lang].downloadOptionsHeader;
    }
  };

  // Language Detection & Initialization
  const detectUserLanguage = () => {
    // Check local timezone resolver
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isTurkeyTimeZone = tz && (
      tz.includes('Istanbul') || 
      tz.includes('Turkey') || 
      tz.includes('Ankara') || 
      tz.includes('GMT-3')
    );
    
    // Check GMT+3 offset (Turkey is UTC+3, which has a timezone offset of -180 minutes)
    const isTurkeyOffset = new Date().getTimezoneOffset() === -180;
    
    // Check user languages
    const isTurkishBrowser = navigator.languages
      ? navigator.languages.some(l => l.toLowerCase().startsWith('tr'))
      : (navigator.language && navigator.language.toLowerCase().startsWith('tr'));

    if (isTurkeyTimeZone || isTurkeyOffset || isTurkishBrowser) {
      currentLang = 'tr';
    } else {
      currentLang = 'en';
    }
  };

  let userManuallySwitched = false;

  // Run initial detection
  detectUserLanguage();
  
  // Set up click listeners for language buttons
  document.getElementById('btn-lang-tr').addEventListener('click', () => {
    userManuallySwitched = true;
    setLanguage('tr');
  });
  document.getElementById('btn-lang-en').addEventListener('click', () => {
    userManuallySwitched = true;
    setLanguage('en');
  });

  // Run initial translation
  setLanguage(currentLang);

  // Background Geolocation Check (Fast, asynchronous, fallback)
  fetch('https://ipapi.co/json/')
    .then(res => res.json())
    .catch(() => fetch('https://ip-api.com/json/').then(res => res.json()))
    .then(data => {
      if (userManuallySwitched) return;
      if (data) {
        const isTR = data.country === 'TR' || data.country_code === 'TR' || (data.timezone && data.timezone.includes('Istanbul'));
        setLanguage(isTR ? 'tr' : 'en');
      }
    })
    .catch(() => {
      // Fallback silently to browser detection
    });

  // 1. Platform Tab Switcher Event Listeners
  tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      tabItems.forEach(t => t.classList.remove('active'));
      
      // Add active to current tab
      tab.classList.add('active');
      activePlatform = tab.getAttribute('data-platform');
      
      // Update input placeholder
      urlInput.placeholder = placeholders[activePlatform];
      
      // Validate current input value immediately
      validateInput();
    });
  });

  // Helper validation matching regex
  function validateInput() {
    const url = urlInput.value.trim();
    
    // Clear indicators and card themes first
    hideElement(filterIndicator);
    downloaderCard.classList.remove('youtube-theme', 'instagram-theme', 'tiktok-theme');

    if (!url) return true;

    // Apply card styling theme preview based on url content
    if (patterns.youtube.test(url)) {
      downloaderCard.classList.add('youtube-theme');
    } else if (patterns.instagram.test(url)) {
      downloaderCard.classList.add('instagram-theme');
    } else if (patterns.tiktok.test(url)) {
      downloaderCard.classList.add('tiktok-theme');
    }

    // Perform platform selection validation restriction
    if (activePlatform === 'youtube' && !patterns.youtube.test(url)) {
      showIndicator(translations[currentLang].errYoutubeOnly);
      return false;
    }
    if (activePlatform === 'instagram' && !patterns.instagram.test(url)) {
      showIndicator(translations[currentLang].errInstagramOnly);
      return false;
    }
    if (activePlatform === 'tiktok' && !patterns.tiktok.test(url)) {
      showIndicator(translations[currentLang].errTiktokOnly);
      return false;
    }
    
    return true;
  }

  // Bind input listeners
  urlInput.addEventListener('input', validateInput);

  function showIndicator(message) {
    indicatorText.textContent = message;
    showElement(filterIndicator);
  }

  // 2. Paste Clipboard Integration
  btnPaste.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        urlInput.value = text;
        
        // Trigger validate input
        const isValid = validateInput();
        
        // Brief button success animation feedback
        btnPaste.classList.add('success-state');
        btnPaste.innerHTML = translations[currentLang].btnPasteSuccess;
        btnPaste.style.borderColor = '#00ff88';
        btnPaste.style.color = '#00ff88';
        setTimeout(() => {
          btnPaste.classList.remove('success-state');
          btnPaste.innerHTML = translations[currentLang].btnPaste;
          btnPaste.style.borderColor = '';
          btnPaste.style.color = '';
        }, 1500);
        
        if (isValid && text) {
          handleDownload();
        }
      } else {
        alert(translations[currentLang].clipboardUnsupported);
      }
    } catch (err) {
      console.warn('Clipboard read failed: ', err);
      alert(translations[currentLang].clipboardPermissionDenied);
    }
  });

  // 3. Process Download Request
  btnDownload.addEventListener('click', handleDownload);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleDownload();
    }
  });

  async function handleDownload() {
    const url = urlInput.value.trim();
    
    if (!url) {
      showError(translations[currentLang].errorTitleMissing, translations[currentLang].errorTextMissing);
      return;
    }

    // Ensure link matches selected platform filter
    if (!validateInput()) {
      showError(translations[currentLang].errorTitleMismatch, translations[currentLang].errorTextMismatch);
      return;
    }

    // Reset UI states
    hideElement(resultCard);
    hideElement(errorCard);
    showElement(loadingState);
    btnDownload.disabled = true;
    btnDownload.innerHTML = translations[currentLang].btnDownloadQuerying;

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      
      hideElement(loadingState);
      btnDownload.disabled = false;
      btnDownload.innerHTML = translations[currentLang].btnDownloadQuery;

      if (!response.ok || data.error) {
        showError(translations[currentLang].errorTitleQuery, data.error || (currentLang === 'tr' ? 'Video bilgileri çekilemedi.' : 'Could not retrieve video information.'));
        return;
      }

      displayResults(data);

    } catch (err) {
      console.error(err);
      hideElement(loadingState);
      btnDownload.disabled = false;
      btnDownload.innerHTML = translations[currentLang].btnDownloadQuery;
      showError(translations[currentLang].errorTitleConnection, translations[currentLang].errorTextConnection);
    }
  }

  // 4. Render results onto double column result container
  function displayResults(data) {
    // Set metadata fields
    videoTitle.textContent = data.title || translations[currentLang].untitledMedia;
    videoAuthor.textContent = data.author || translations[currentLang].unknownCreator;
    videoDuration.textContent = data.duration || 'N/A';
    
    // Set thumbnail or fallback image
    const setFallbackThumbnail = (platform) => {
      if (platform === 'youtube') {
        videoThumb.src = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=400&auto=format&fit=crop';
      } else if (platform === 'instagram') {
        videoThumb.src = 'https://images.unsplash.com/photo-1611224885990-ab7363d1f2a9?q=80&w=400&auto=format&fit=crop';
      } else {
        videoThumb.src = 'https://images.unsplash.com/photo-1596558450268-9c27524ba856?q=80&w=400&auto=format&fit=crop';
      }
    };

    if (data.thumbnail) {
      if (data.platform === 'instagram' || data.platform === 'tiktok') {
        videoThumb.src = `/api/proxy-image?url=${encodeURIComponent(data.thumbnail)}`;
      } else {
        videoThumb.src = data.thumbnail;
      }
      videoThumb.onerror = () => {
        setFallbackThumbnail(data.platform);
      };
    } else {
      setFallbackThumbnail(data.platform);
    }

    // Set dynamic aspect ratio based on video dimensions
    const resultMedia = videoThumb.parentElement;
    if (data.width && data.height) {
      const width = data.width;
      const height = data.height;
      resultMedia.style.setProperty('aspect-ratio', `${width} / ${height}`);
      if (width >= height) {
        // Landscape or Square (1:1)
        resultMedia.style.setProperty('max-width', '100%');
        resultMedia.style.setProperty('margin', '0');
      } else {
        // Portrait (e.g., 9:16)
        resultMedia.style.setProperty('max-width', '260px');
        resultMedia.style.setProperty('margin', '0 auto');
      }
    } else {
      // Fallbacks when dimensions are unknown
      if (data.platform === 'youtube') {
        resultMedia.style.setProperty('aspect-ratio', '16 / 10');
        resultMedia.style.setProperty('max-width', '100%');
        resultMedia.style.setProperty('margin', '0');
      } else {
        // Instagram and TikTok Reels fallback
        resultMedia.style.setProperty('aspect-ratio', '9 / 16');
        resultMedia.style.setProperty('max-width', '260px');
        resultMedia.style.setProperty('margin', '0 auto');
      }
    }

    // Set platform theme on card
    downloaderCard.classList.remove('youtube-theme', 'instagram-theme', 'tiktok-theme');
    downloaderCard.classList.add(`${data.platform}-theme`);

    // Set platform badge icon
    platformBadge.innerHTML = '';
    const badgeIcon = document.createElement('i');
    if (data.platform === 'youtube') {
      badgeIcon.className = 'fa-brands fa-youtube';
    } else if (data.platform === 'instagram') {
      badgeIcon.className = 'fa-brands fa-instagram';
    } else if (data.platform === 'tiktok') {
      badgeIcon.className = 'fa-brands fa-tiktok';
    } else {
      badgeIcon.className = 'fa-solid fa-globe';
    }
    platformBadge.appendChild(badgeIcon);

    // Build Options List
    optionsContainer.innerHTML = '';
    
    if (!data.downloads || data.downloads.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = translations[currentLang].noDownloadOptions;
      optionsContainer.appendChild(emptyMsg);
    } else {
      data.downloads.forEach(dl => {
        const option = document.createElement('a');
        option.className = 'download-option-btn';
        
        // Clean title for safe filename
        const safeTitle = (data.title || 'video')
          .replace(/[\\/*?:"<>|]/g, '') // remove illegal characters
          .substring(0, 80)
          .trim();
        const filename = `${data.platform.toUpperCase()}_${safeTitle}.${dl.ext}`;
        
        // Use custom JavaScript click flow for all platforms
        option.href = '#';
        
        // Icon for Option
        const isAudio = dl.type === 'audio' || dl.ext === 'mp3';
        const optionIconClass = isAudio ? 'fa-solid fa-music' : 'fa-solid fa-circle-down';
        
        option.innerHTML = `
          <div class="option-left">
            <span class="option-icon"><i class="${optionIconClass}"></i></span>
            <span class="option-quality">${dl.quality}</span>
          </div>
          <div class="option-right">
            <span class="option-download-txt">${translations[currentLang].btnDownloadAction} <i class="fa-solid fa-arrow-right"></i></span>
          </div>
        `;
        
        // Stateful Click Handler for ALL platforms
        option.addEventListener('click', async (e) => {
          e.preventDefault(); // prevent navigation
          
          const txtSpan = option.querySelector('.option-download-txt');
          const originalHTML = txtSpan.innerHTML;
          
          txtSpan.innerHTML = `${translations[currentLang].btnDownloadStarting} <i class="fa-solid fa-spinner fa-spin"></i>`;
          txtSpan.style.color = '#00ff88';
          option.style.pointerEvents = 'none'; // prevent double click
          
          try {
            const startResponse = await fetch('/api/download-start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: urlInput.value.trim(),
                quality: dl.qualityKey || 'best',
                platform: data.platform,
                filename: filename
              })
            });
            
            const startData = await startResponse.json();
            if (startData.error || !startData.downloadId) {
              throw new Error(startData.error || translations[currentLang].btnDownloadFailed);
            }
            
            const downloadId = startData.downloadId;
            
            // Start progress polling
            const pollInterval = setInterval(async () => {
              try {
                const progressResponse = await fetch(`/api/download-progress?id=${downloadId}`);
                const progressData = await progressResponse.json();
                
                if (progressData.status === 'downloading') {
                  txtSpan.innerHTML = `${translations[currentLang].btnDownloadingAction} %${Math.round(progressData.progress)} <i class="fa-solid fa-circle-notch fa-spin"></i>`;
                } else if (progressData.status === 'merging') {
                  txtSpan.innerHTML = `${translations[currentLang].btnMergingAction} <i class="fa-solid fa-spinner fa-spin"></i>`;
                } else if (progressData.status === 'completed') {
                  clearInterval(pollInterval);
                  txtSpan.innerHTML = `${translations[currentLang].btnCompletedAction} <i class="fa-solid fa-check"></i>`;
                  
                  // Trigger native browser download
                  window.location.href = `/api/download-retrieve?id=${downloadId}`;
                  
                  // Reset button after download starts
                  setTimeout(() => {
                    txtSpan.innerHTML = originalHTML;
                    txtSpan.style.color = '';
                    option.style.pointerEvents = 'auto';
                  }, 4000);
                } else if (progressData.status === 'failed') {
                  clearInterval(pollInterval);
                  txtSpan.innerHTML = translations[currentLang].btnFailedAction;
                  txtSpan.style.color = '#ff4a4a';
                  alert(`${currentLang === 'tr' ? 'İndirme hatası' : 'Download error'}: ${progressData.error || (currentLang === 'tr' ? 'İşlem başarısız.' : 'Process failed.')}`);
                  
                  setTimeout(() => {
                    txtSpan.innerHTML = originalHTML;
                    txtSpan.style.color = '';
                    option.style.pointerEvents = 'auto';
                  }, 4000);
                }
              } catch (pollErr) {
                console.error('Polling error:', pollErr);
              }
            }, 1500);
            
          } catch (err) {
            console.error(err);
            txtSpan.innerHTML = `${currentLang === 'tr' ? 'Hata!' : 'Error!'}`;
            txtSpan.style.color = '#ff4a4a';
            alert(err.message || (currentLang === 'tr' ? 'İndirme işlemi başlatılırken hata oluştu.' : 'An error occurred while starting the download.'));
            
            setTimeout(() => {
              txtSpan.innerHTML = originalHTML;
              txtSpan.style.color = '';
              option.style.pointerEvents = 'auto';
            }, 4000);
          }
        });

        optionsContainer.appendChild(option);
      });
    }

    showElement(resultCard);
  }

  // 5. Utility helper show/hide elements
  function showElement(el) {
    el.classList.remove('hidden');
  }

  function hideElement(el) {
    el.classList.add('hidden');
  }

  function showError(title, message) {
    errorTitle.textContent = title;
    errorText.textContent = message;
    showElement(errorCard);
  }

  // 6. Modals Event Listeners for About Us & Privacy Policy
  const linkAbout = document.getElementById('link-about');
  const linkPrivacy = document.getElementById('link-privacy');
  const modalAbout = document.getElementById('modal-about');
  const modalPrivacy = document.getElementById('modal-privacy');
  const closeAbout = document.getElementById('close-about');
  const closePrivacy = document.getElementById('close-privacy');

  const openModal = (modal) => {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = (modal) => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  linkAbout.addEventListener('click', (e) => {
    e.preventDefault();
    openModal(modalAbout);
  });

  linkPrivacy.addEventListener('click', (e) => {
    e.preventDefault();
    openModal(modalPrivacy);
  });

  closeAbout.addEventListener('click', () => closeModal(modalAbout));
  closePrivacy.addEventListener('click', () => closeModal(modalPrivacy));

  // Close when clicking background outside the modal-content
  window.addEventListener('click', (e) => {
    if (e.target === modalAbout) closeModal(modalAbout);
    if (e.target === modalPrivacy) closeModal(modalPrivacy);
  });
});
