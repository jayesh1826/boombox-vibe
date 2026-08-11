let player = null;           // Master Audio Engine
let bgVideoPlayer = null;    // Slave Video Background Engine

const PLAYLIST_POOL = [
  'PL4fGSI1pDJn5RgLW0Sb_zECecWdH_4zOX',
  'RDCLAK5uy_nWw3L1vcgAaz_YeU70VZkhHeomK4IBUBo',
  'RDCLAK5uy_kkmYQJUx6MqEE1Uj3Y0UhBxzwOfAWpHm0',
  'RDCLAK5uy_l_Bj8rMsjkhFMMs-eLrA17_zjr9r6g_Eg',
  'RDCLAK5uy_n9Fbdw7e6ap-98_A-8JYBmPv64v-Uaq1g'
];

let activePlaylistId = PLAYLIST_POOL[0];
let fullPlaylistIds = [];
let currentTrackIndex = -1;
let currentVolume = 80;

let isVisualizerRunning = false;
let isPlaying = false;
let isCassetteInserted = true;
let isVideoModeActive = false;
let currentVideoId = '';

// Initialize Master Audio and Slave Video Players
function onYouTubeIframeAPIReady() {
  // Master Audio Player
  player = new YT.Player('yt-player', {
    height: '100%',
    width: '100%',
    playerVars: { 
      'autoplay': 1, 
      'controls': 0, 
      'modestbranding': 1, 
      'rel': 0,
      'enablejsapi': 1,
      'listType': 'playlist',
      'list': activePlaylistId,
      'origin': window.location.origin
    },
    events: { 
      'onReady': onMasterPlayerReady,
      'onStateChange': onMasterPlayerStateChange
    }
  });

  // Slave Video Background Player (Muted, Synchronized)
  bgVideoPlayer = new YT.Player('bg-video-player', {
    height: '100%',
    width: '100%',
    playerVars: {
      'autoplay': 1,
      'controls': 0,
      'modestbranding': 1,
      'rel': 0,
      'mute': 1,
      'enablejsapi': 1,
      'origin': window.location.origin
    },
    events: {
      'onReady': (event) => { event.target.mute(); }
    }
  });
}

function onMasterPlayerReady(event) {
  playRandomTrackFromPlaylist();
  initBeatVisualizer();
  setupHorizontalVolumeBar();
  setupCassettePhysics();
  
  // Real-time synchronization loop: checks audio/video time alignment every 1 second
  setInterval(syncVideoWithAudioTime, 1000);
}

// Master-Slave Time Alignment Engine
function syncVideoWithAudioTime() {
  if (!player || !bgVideoPlayer || !isPlaying || !isCassetteInserted) return;

  try {
    const audioTime = player.getCurrentTime();
    const videoTime = bgVideoPlayer.getCurrentTime();

    // Force video to seek if playback drift exceeds 0.4 seconds
    if (Math.abs(audioTime - videoTime) > 0.4) {
      bgVideoPlayer.seekTo(audioTime, true);
    }
  } catch (e) {
    // Ignore iframe initialization transients
  }
}

function onMasterPlayerStateChange(event) {
  const boombox = document.getElementById('boombox-chassis');
  const spools = document.querySelectorAll('.spool');
  const cassette = document.getElementById('cassette-tape');

  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    isCassetteInserted = true;

    if (boombox) boombox.classList.add('playing');
    if (cassette) {
      cassette.classList.add('inserted');
      cassette.classList.remove('ejected');
    }
    spools.forEach(s => s.classList.remove('paused'));
    
    const toggleBtn = document.getElementById('btn-toggle');
    if (toggleBtn) toggleBtn.innerText = '⏸';

    if (player && player.getVideoData) {
      const videoData = player.getVideoData();
      if (videoData && videoData.title) {
        document.getElementById('curr-title').innerText = videoData.title;
        document.getElementById('curr-artist').innerText = videoData.author || "Retro Radio";
        document.getElementById('cassette-song-title').innerText = videoData.title;

        // Load new track video into slave background player
        if (videoData.video_id && videoData.video_id !== currentVideoId) {
          currentVideoId = videoData.video_id;
          if (bgVideoPlayer && bgVideoPlayer.loadVideoById) {
            bgVideoPlayer.loadVideoById(currentVideoId);
            bgVideoPlayer.mute();
          }
        } else if (bgVideoPlayer && bgVideoPlayer.playVideo) {
          bgVideoPlayer.playVideo();
        }

        const ytMusicBtn = document.getElementById('yt-music-link');
        if (ytMusicBtn && videoData.video_id) {
          ytMusicBtn.href = `https://music.youtube.com/watch?v=${videoData.video_id}&list=${activePlaylistId}`;
        }
      }
    }
  } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
    isPlaying = false;
    if (boombox) boombox.classList.remove('playing');
    spools.forEach(s => s.classList.add('paused'));
    
    const toggleBtn = document.getElementById('btn-toggle');
    if (toggleBtn) toggleBtn.innerText = '▶';

    // PAUSE BACKGROUND VIDEO IMMEDIATELY
    if (bgVideoPlayer && bgVideoPlayer.pauseVideo) {
      bgVideoPlayer.pauseVideo();
    }
  }

  if (event.data === YT.PlayerState.ENDED) {
    isPlaying = false;
    if (bgVideoPlayer && bgVideoPlayer.pauseVideo) {
      bgVideoPlayer.pauseVideo();
    }
    playRandomTrackFromPlaylist();
  }
}

function toggleVideoMode() {
  const bgContainer = document.getElementById('video-container');
  const overlay = document.getElementById('video-overlay');
  const chassis = document.getElementById('boombox-chassis');
  const videoBtn = document.getElementById('btn-video-mode');
  const contentWrapper = document.querySelector('.main-content-wrapper');

  isVideoModeActive = !isVideoModeActive;

  if (isVideoModeActive) {
    if (bgContainer) bgContainer.classList.add('full-clear-mode');
    if (overlay) overlay.classList.add('clear-mode');
    if (chassis) chassis.classList.add('minimized-mode');
    if (videoBtn) videoBtn.classList.add('active');
    if (contentWrapper) contentWrapper.classList.add('hide-branding');
  } else {
    if (bgContainer) bgContainer.classList.remove('full-clear-mode');
    if (overlay) overlay.classList.remove('clear-mode');
    if (chassis) chassis.classList.remove('minimized-mode');
    if (videoBtn) videoBtn.classList.remove('active');
    if (contentWrapper) contentWrapper.classList.remove('hide-branding');
  }
}

function initDotsBeatBarEngine() {
  const canvas = document.getElementById('dots-beat-bar');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const pixelCount = 120;
  const pixels = [];

  for (let i = 0; i < pixelCount; i++) {
    pixels.push({
      x: Math.random() * (canvas.width || 400),
      y: Math.random() * (canvas.height || 28),
      size: Math.random() < 0.6 ? 1 : 1.8,
      speedX: (Math.random() * 1.5 + 0.5) * (Math.random() < 0.5 ? 1 : -1),
      speedY: (Math.random() * 0.8 + 0.2) * (Math.random() < 0.5 ? 1 : -1),
      alpha: Math.random() * 0.4 + 0.1,
      baseAlpha: Math.random() * 0.3 + 0.1
    });
  }

  let simulatedPhase = 0;

  function renderPixelFlow() {
    requestAnimationFrame(renderPixelFlow);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let beatIntensity = 0;
    if (isPlaying && isCassetteInserted) {
      simulatedPhase += 0.12;
      beatIntensity = Math.abs(Math.sin(simulatedPhase) * Math.cos(simulatedPhase * 0.5));
    }

    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];

      if (isPlaying && isCassetteInserted) {
        p.x += p.speedX * (1 + beatIntensity * 2.5);
        p.y += p.speedY * (1 + beatIntensity * 1.5);
        p.alpha = Math.min(1, p.baseAlpha + beatIntensity * 0.7);

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      } else {
        p.alpha = Math.max(0.08, p.baseAlpha * 0.4);
      }

      ctx.fillStyle = `#FAF6EE`;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
  }

  renderPixelFlow();
}

function initBeatVisualizer() {
  if (isVisualizerRunning) return;
  
  initDotsBeatBarEngine();

  let simulatedPhase = 0;

  function renderBeatFrame() {
    requestAnimationFrame(renderBeatFrame);

    let beatIntensity = 0;

    if (isPlaying && isCassetteInserted) {
      simulatedPhase += 0.12;
      beatIntensity = Math.abs(Math.sin(simulatedPhase) * Math.cos(simulatedPhase * 0.5));
    } else {
      beatIntensity = 0;
      simulatedPhase = 0;
    }
const glowValue = isVideoModeActive ? 0 : beatIntensity.toFixed(2);
  document.documentElement.style.setProperty('--beat-glow', glowValue);
  
  const glowEl = document.querySelector('.beat-ambient-glow');
  if (glowEl) {
    if (isVideoModeActive) {
      glowEl.style.opacity = '0';
      glowEl.style.visibility = 'hidden';
    } else {
      glowEl.style.visibility = 'visible';
      glowEl.style.opacity = (0.12 + beatIntensity * 0.45).toString();
    }
  }
    document.documentElement.style.setProperty('--beat-color', '#E66A2B');
    document.documentElement.style.setProperty('--beat-glow', beatIntensity.toFixed(2));

    const vuLeft = document.getElementById('vu-left');
    const vuRight = document.getElementById('vu-right');
    const leftCone = document.getElementById('left-cone');
    const rightCone = document.getElementById('right-cone');
    const bgContainer = document.getElementById('video-container');

    if (vuLeft && vuRight) {
      const angle = isPlaying ? (-30 + beatIntensity * 60) : -30;
      vuLeft.style.transform = `rotate(${angle}deg)`;
      vuRight.style.transform = `rotate(${angle * 0.85}deg)`;
    }

    if (leftCone && rightCone) {
      const scale = isPlaying ? (1 + beatIntensity * 0.05) : 1;
      leftCone.style.transform = `scale(${scale})`;
      rightCone.style.transform = `scale(${scale})`;
    }

    if (bgContainer && isPlaying && !isVideoModeActive) {
      const bgScale = 1.05 + beatIntensity * 0.02;
      bgContainer.style.transform = `scale(${bgScale})`;
    }
  }

  renderBeatFrame();
  isVisualizerRunning = true;
}

function setupCassettePhysics() {
  const cassette = document.getElementById('cassette-tape');
  const slot = document.getElementById('cassette-slot');
  if (!cassette || !slot) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;

  cassette.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);

  cassette.addEventListener('touchstart', startDrag, { passive: true });
  document.addEventListener('touchmove', onDrag, { passive: true });
  document.addEventListener('touchend', stopDrag);

  function startDrag(e) {
    isDragging = true;
    startX = e.clientX || (e.touches && e.touches[0].clientX);
    startY = e.clientY || (e.touches && e.touches[0].clientY);
    cassette.style.transition = 'none';
  }

  function onDrag(e) {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (!clientX || !clientY) return;

    const deltaY = clientY - startY;
    const deltaX = clientX - startX;

    if (isCassetteInserted && Math.abs(deltaX) > 15) {
      const spools = document.querySelectorAll('.spool');
      spools.forEach(s => s.style.transform = `rotate(${deltaX * 3}deg)`);
    }

    if (deltaY < -30) {
      cassette.classList.remove('inserted');
      cassette.classList.add('ejected');
      isCassetteInserted = false;
    } else if (deltaY > 30) {
      cassette.classList.remove('ejected');
      cassette.classList.add('inserted');
      isCassetteInserted = true;
    }
  }

  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    cassette.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    if (isCassetteInserted) {
      cassette.classList.add('inserted');
      cassette.classList.remove('ejected');
      if (player && player.playVideo) player.playVideo();
      if (bgVideoPlayer && bgVideoPlayer.playVideo) bgVideoPlayer.playVideo();
    } else {
      cassette.classList.remove('inserted');
      cassette.classList.add('ejected');
      if (player && player.pauseVideo) player.pauseVideo();
      if (bgVideoPlayer && bgVideoPlayer.pauseVideo) bgVideoPlayer.pauseVideo();
    }
  }
}

function setupHorizontalVolumeBar() {
  const volBar = document.getElementById('horizontal-vol-bar');
  if (!volBar) return;

  let isDragging = false;

  function updateVolumeFromX(e) {
    const rect = volBar.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (!clientX) return;

    let offsetX = clientX - rect.left;
    offsetX = Math.max(0, Math.min(rect.width, offsetX));

    const percentage = offsetX / rect.width;
    currentVolume = Math.round(percentage * 100);

    document.documentElement.style.setProperty('--volume-fill-pct', `${currentVolume}%`);

    if (player && player.setVolume) {
      player.setVolume(currentVolume);
    }
  }

  volBar.addEventListener('mousedown', (e) => {
    isDragging = true;
    updateVolumeFromX(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) updateVolumeFromX(e);
  });

  document.addEventListener('mouseup', () => { isDragging = false; });

  volBar.addEventListener('touchstart', (e) => {
    isDragging = true;
    updateVolumeFromX(e);
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (isDragging) updateVolumeFromX(e);
  }, { passive: true });

  document.addEventListener('touchend', () => { isDragging = false; });
}

function playRandomTrackFromPlaylist() {
  if (!player) return;

  const randomPlaylist = PLAYLIST_POOL[Math.floor(Math.random() * PLAYLIST_POOL.length)];

  if (player.getPlaylist) {
    fullPlaylistIds = player.getPlaylist() || [];
  }

  if (fullPlaylistIds.length > 0) {
    let randomIndex = Math.floor(Math.random() * fullPlaylistIds.length);
    if (fullPlaylistIds.length > 1 && randomIndex === currentTrackIndex) {
      randomIndex = (randomIndex + 1) % fullPlaylistIds.length;
    }
    currentTrackIndex = randomIndex;
    
    if (player.playVideoAt) {
      player.playVideoAt(currentTrackIndex);
    }
  } else if (player.nextVideo) {
    player.nextVideo();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const vibeBtn = document.getElementById('btn-vibe');
  if (vibeBtn) vibeBtn.addEventListener('click', playRandomTrackFromPlaylist);

  const videoBtn = document.getElementById('btn-video-mode');
  if (videoBtn) videoBtn.addEventListener('click', toggleVideoMode);

  const chassis = document.getElementById('boombox-chassis');
  if (chassis) {
    chassis.addEventListener('click', (e) => {
      if (isVideoModeActive) {
        toggleVideoMode();
      }
    });
  }

  const toggleBtn = document.getElementById('btn-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (!player) return;
      const state = player.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
        if (bgVideoPlayer && bgVideoPlayer.pauseVideo) bgVideoPlayer.pauseVideo();
      } else {
        player.playVideo();
        if (bgVideoPlayer && bgVideoPlayer.playVideo) bgVideoPlayer.playVideo();
      }
    });
  }

  const powerBtn = document.getElementById('btn-power');
  if (powerBtn) {
    powerBtn.addEventListener('click', () => {
      if (!player) return;
      const state = player.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
        if (bgVideoPlayer && bgVideoPlayer.pauseVideo) bgVideoPlayer.pauseVideo();
      } else {
        player.playVideo();
        if (bgVideoPlayer && bgVideoPlayer.playVideo) bgVideoPlayer.playVideo();
      }
    });
  }

  const ejectBtn = document.getElementById('btn-eject');
  if (ejectBtn) {
    ejectBtn.addEventListener('click', () => {
      const cassette = document.getElementById('cassette-tape');
      if (cassette) {
        cassette.classList.remove('inserted');
        cassette.classList.add('ejected');
        isCassetteInserted = false;
      }
      if (player && player.pauseVideo) player.pauseVideo();
      if (bgVideoPlayer && bgVideoPlayer.pauseVideo) bgVideoPlayer.pauseVideo();
    });
  }

  const randomBtn = document.getElementById('btn-random');
  if (randomBtn) {
    randomBtn.addEventListener('click', playRandomTrackFromPlaylist);
  }
});
