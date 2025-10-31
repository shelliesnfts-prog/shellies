//Main Class through which both the game and level editor are instantiated

var MarioMaker = (function() {
  var instance;

  function MarioMaker() {
    var view = View.getInstance();

    var mainWrapper;
    var startScreen;
    var btnWrapper;

    var editorButton;
    var startGameButton;
    var createdLevelsButton;

    var editorStarted = 0;

    var backToMenuBtn;
    var currentGameLevel = 1; // Track the current level for respawning

    //instances
    var marioGame;
    var editor;
    var createdLevels;

    var that = this;

    this.init = function() {
      marioGame = new MarioGame();
      editor = new Editor();
      createdLevels = new CreatedLevels();
      
      // Listen for restart messages from parent window
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'RESTART_GAME') {
          that.restartCurrentGame();
        } else if (event.data && event.data.type === 'NAVIGATE_TO_LEVEL') {
          const targetLevel = event.data.level;
          if (targetLevel >= 1 && targetLevel <= 999) {
            that.navigateToLevel(targetLevel);
          }
        }
      });

      //main menu screen
      mainWrapper = view.getMainWrapper();
      startScreen = view.create('div');
      //btnWrapper = view.create('div');
      //editorButton = view.create('button');
      startGameButton = view.create('button');
      //createdLevelsButton = view.create('div');
      backToMenuBtn = view.create('button');

      //view.addClass(btnWrapper, 'btn-wrapper');
      view.addClass(startScreen, 'start-screen');
      //view.addClass(editorButton, 'editor-btn');
      view.addClass(startGameButton, 'start-btn');
      //view.addClass(createdLevelsButton, 'created-btn');
      view.addClass(backToMenuBtn, 'back-btn');

      //view.append(startScreen, editorButton);
      view.append(startScreen, startGameButton);
      //view.append(startScreen, createdLevelsButton);
      //view.append(btnWrapper, backToMenuBtn);
      view.append(mainWrapper, startScreen);
      //view.append(mainWrapper, btnWrapper);

      //editorButton.onclick = that.startEditor;

      //createdLevelsButton.onclick = that.startCreatedLevels;

      backToMenuBtn.onclick = that.backToMenu;

      startGameButton.onclick = function() {
        map = that.loadMainGameMap();
        that.startGame(map);
      };
    };

    this.loadMainGameMap = function() {
      var map = {};

      for (let level = 1; level <= 999; level++) {
        map[level] = that.generateDynamicLevel(level);
      }

      return map;
    };

    this.generateDynamicLevel = function(levelNumber) {
      const width = 120;
      const height = 15;
      // Conservative difficulty scaling based on v1 pattern but with more gradual progression
      const difficulty = Math.floor((levelNumber - 1) / 7); // Increases every 7 levels for slightly faster progression than before
      const cappedDifficulty = Math.min(difficulty, 8); // Slightly higher cap but still conservative
      
      that.setRandomSeed(levelNumber);
      
      let level = [];
      for (let y = 0; y < height; y++) {
        level[y] = [];
        for (let x = 0; x < width; x++) {
          level[y][x] = 0;
        }
      }
      
      level[height - 1] = new Array(width).fill(1);
      
      // Generate levels with distinct themes and structures
      const theme = that.selectLevelTheme(levelNumber);
      
      if (levelNumber === 1) {
        that.generateLevel1(level, width, height);
      } else {
        that.generateThemedLevel(level, width, height, levelNumber, cappedDifficulty, theme);
      }
      
      level[1][width - 3] = 6;
      level[1][width - 2] = 5;
      for (let i = 2; i < height - 1; i++) {
        level[i][width - 2] = 5;
      }
      
      // Apply global safety check to ensure no structure blocks Mario's path
      that.applySafetyCheck(level, width, height);
      
      // Add stepping stones for high platforms to ensure reachability
      that.addSteppingStones(level, width, height);
      
      // Add exactly 10-15 coins to the level (single centralized call)
      that.addCoinsToLevel(level, width, height, levelNumber);
      
      return JSON.stringify(level);
    };

    this.setRandomSeed = function(seed) {
      that.seed = seed;
    };

    this.seededRandom = function() {
      const x = Math.sin(that.seed++) * 10000;
      return x - Math.floor(x);
    };

    this.selectLevelTheme = function(levelNumber) {
      // Rotate through distinct themes to ensure major variety
      const themes = [
        'plains',      // Basic platforming with simple gaps
        'underground', // Low platforms, many pipes  
        'mountain',    // High platforms, cliff-like structures
        'castle',      // Defensive structures with enemies
        'bridge',      // Suspended platforms over gaps
        'maze',        // Complex pipe networks
        'parkour',     // Precision jumping challenges
        'fortress',    // Enemy-heavy defensive positions
        'sky',         // High floating platforms
        'cavern'       // Mixed high-low complex layout
      ];
      
      const baseTheme = themes[(levelNumber - 2) % themes.length];
      const difficulty = Math.floor((levelNumber - 1) / 7); // Match the new difficulty calculation
      
      // Add difficulty suffix for variations within themes - v1-like conservative progression
      if (difficulty < 1) return baseTheme + '_easy';
      else if (difficulty < 2) return baseTheme + '_medium'; 
      else if (difficulty < 3) return baseTheme + '_hard';
      else return baseTheme + '_expert';
    };

    this.generateLevel1 = function(level, width, height) {
      // Add pipes early - like v1 static levels
      const pipePositions = [18, 35, 52, 75, 95];
      for (let i = 0; i < pipePositions.length; i++) {
        const pipeX = pipePositions[i];
        const pipeHeight = 1; // Always 1 block high to ensure easy navigation
        
        if (pipeX + 1 < width - 10) {
          // Build pipe body
          for (let j = 0; j < pipeHeight; j++) {
            const y = height - 2 - j;
            if (y >= 0) {
              level[y][pipeX] = 7;
              level[y][pipeX + 1] = 8;
            }
          }
          // Add pipe top
          const topY = height - 2 - pipeHeight;
          if (topY >= 0) {
            level[topY][pipeX] = 9;
            level[topY][pipeX + 1] = 10;
          }
        }
      }
      
      // Create stepping stone platforms between pipes
      for (let i = 0; i < 4; i++) {
        const baseX = 25 + (i * 18);
        const platformY = 10 + (i % 2 === 0 ? 0 : 1);
        const platformLength = 3 + Math.floor(that.seededRandom() * 2);
        
        for (let j = 0; j < platformLength; j++) {
          if (baseX + j < width - 10) {
            level[platformY][baseX + j] = 1;
          }
        }
        
        // Coins will be added centrally by addCoinsToLevel function
      }
      
      // Add more enemies for better challenge - some on pipes
      level[height - 2][30] = 20;
      level[height - 2][50] = 20;
      level[height - 2][65] = 20;
      level[height - 2][85] = 20;
      
      // Add question blocks with higher placement
      level[height - 11][40] = 3; // 11 blocks above ground
      level[height - 11][70] = 3; // 11 blocks above ground  
      level[height - 10][55] = 3; // 10 blocks above ground
      
      // Add some ground gaps like v1 levels
      for (let j = 0; j < 3; j++) {
        if (42 + j < width - 10) {
          level[height - 1][42 + j] = 0; // Gap after first pipe
        }
      }
      
    };

    // Safe helper function to set level blocks with boundary checking
    this.safeSetBlock = function(level, x, y, width, height, blockType) {
      if (x >= 0 && x < width && y >= 0 && y < height && level[y]) {
        level[y][x] = blockType;
        return true;
      }
      return false;
    };

    this.generateThemedLevel = function(level, width, height, levelNumber, difficulty, theme) {
      // Ignore complex themes - just generate simple v1-style levels with gradual progression
      
      // Clear any existing structures except ground
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width; x++) {
          if (level[y]) level[y][x] = 0;
        }
      }
      
      // Simple theme rotation - use only the basic themes
      const simpleThemes = ['plains', 'underground', 'mountain'];
      const selectedTheme = simpleThemes[(levelNumber - 2) % simpleThemes.length];
      
      switch(selectedTheme) {
        case 'plains':
          this.generatePlainsLevel(level, width, height, difficulty, 'easy');
          break;
        case 'underground':
          this.generateUndergroundLevel(level, width, height, difficulty, 'easy');
          break;
        case 'mountain':
          this.generateMountainLevel(level, width, height, difficulty, 'easy');
          break;
      }
      
      // Add natural enemy placement after structure generation
      this.addNaturalEnemies(level, width, height, selectedTheme, difficulty);
      
      // Add limited question blocks (1-3 per level)
      this.addLimitedQuestionBlocks(level, width, height, Math.min(1 + Math.floor(difficulty / 2), 3));
    };

    // Plains Theme: Classic Mario platforming with simple v1-like structures
    this.generatePlainsLevel = function(level, width, height, difficulty, difficultyLevel) {
      // Add simple pipes like v1 - scattered throughout
      const pipeCount = 3 + difficulty; // Very conservative pipe count
      for (let i = 0; i < pipeCount; i++) {
        const x = 20 + i * 20 + Math.floor(that.seededRandom() * 10);
        if (x + 1 < width - 10) {
          // Always 1 block high pipes
          that.safeSetBlock(level, x, height - 2, width, height, 7);
          that.safeSetBlock(level, x + 1, height - 2, width, height, 8);
          that.safeSetBlock(level, x, height - 3, width, height, 9);
          that.safeSetBlock(level, x + 1, height - 3, width, height, 10);
        }
      }
      
      // Add simple platforms like v1 - low and accessible
      const platformCount = 2 + Math.floor(difficulty / 2);
      for (let i = 0; i < platformCount; i++) {
        const x = 25 + i * 30;
        const y = height - 5; // Always same height - predictable
        for (let j = 0; j < 4; j++) {
          that.safeSetBlock(level, x + j, y, width, height, 1);
        }
      }
      
      // Add more strategic ground gaps like v1 - always jumpable but more frequent
      const gapCount = 3 + Math.floor(difficulty / 2); // More gaps as difficulty increases
      for (let i = 0; i < gapCount; i++) {
        const gapX = 25 + i * 25 + Math.floor(that.seededRandom() * 8); // Closer spacing
        const gapWidth = 2 + Math.floor(difficulty / 4); // Gradual gap width increase
        for (let j = 0; j < Math.min(gapWidth, 4); j++) { // Max 4-block gaps (still jumpable)
          that.safeSetBlock(level, gapX + j, height - 1, width, height, 0);
        }
      }
      
      // Add some smaller single-block gaps for variety like v1
      const smallGapCount = 2 + difficulty;
      for (let i = 0; i < smallGapCount; i++) {
        const gapX = 35 + i * 18 + Math.floor(that.seededRandom() * 6);
        if (gapX + 1 < width - 20) {
          that.safeSetBlock(level, gapX, height - 1, width, height, 0);
        }
      }
      
      // Add enemies directly on ground level for guaranteed placement
      const directEnemies = 5 + (difficulty * 2); // Extra enemies on ground
      for (let i = 0; i < directEnemies; i++) {
        const x = 15 + i * 8 + Math.floor(that.seededRandom() * 5);
        if (x < width - 10) {
          that.safeSetBlock(level, x, height - 2, width, height, 20);
        }
      }
      
      // Add some strategic enemies near gaps for added challenge like v1
      if (difficulty > 0) {
        for (let i = 0; i < Math.min(2 + difficulty, 4); i++) {
          const gapNearX = 30 + i * 30 + Math.floor(that.seededRandom() * 6);
          if (gapNearX < width - 15) {
            // Place enemy a few blocks before or after potential gap area
            const enemyOffset = that.seededRandom() < 0.5 ? -3 : 5;
            const enemyX = gapNearX + enemyOffset;
            if (enemyX > 5 && enemyX < width - 5) {
              that.safeSetBlock(level, enemyX, height - 2, width, height, 20);
            }
          }
        }
      }
    };

    // Underground Theme: Simple pipe-heavy level like v1
    this.generateUndergroundLevel = function(level, width, height, difficulty, difficultyLevel) {
      // Add many pipes throughout - signature of underground levels, but v1-style simple
      const pipeCount = Math.min(4 + difficulty, 8); // Conservative pipe count
      for (let i = 0; i < pipeCount; i++) {
        const pipeX = 18 + i * 12;
        
        if (pipeX + 1 < width - 15) {
          // Always 1 block high pipes
          that.safeSetBlock(level, pipeX, height - 2, width, height, 7);
          that.safeSetBlock(level, pipeX + 1, height - 2, width, height, 8);
          that.safeSetBlock(level, pipeX, height - 3, width, height, 9);
          that.safeSetBlock(level, pipeX + 1, height - 3, width, height, 10);
        }
      }
      
      // Add simple platforms like v1
      const platformCount = 2 + Math.floor(difficulty / 2);
      for (let i = 0; i < platformCount; i++) {
        const x = 30 + i * 25;
        const y = height - 6; // Fixed height
        for (let j = 0; j < 3; j++) {
          that.safeSetBlock(level, x + j, y, width, height, 1);
        }
      }
      
      // Add more strategic gaps between pipes like v1 underground levels
      const undergroundGapCount = 2 + Math.floor(difficulty / 2);
      for (let i = 0; i < undergroundGapCount; i++) {
        const gapX = 35 + i * 28 + Math.floor(that.seededRandom() * 5);
        const gapWidth = 2 + Math.floor(difficulty / 3); // Gradual increase
        for (let j = 0; j < Math.min(gapWidth, 4); j++) {
          that.safeSetBlock(level, gapX + j, height - 1, width, height, 0);
        }
      }
      
      // Add some single-block holes for variety like v1
      const singleHoleCount = 3 + difficulty;
      for (let i = 0; i < singleHoleCount; i++) {
        const holeX = 25 + i * 15 + Math.floor(that.seededRandom() * 4);
        if (holeX < width - 15) {
          that.safeSetBlock(level, holeX, height - 1, width, height, 0);
        }
      }
      
      // Add enemies directly on ground level for guaranteed placement
      const directEnemies = 6 + (difficulty * 2); // Extra enemies on ground
      for (let i = 0; i < directEnemies; i++) {
        const x = 20 + i * 9 + Math.floor(that.seededRandom() * 4);
        if (x < width - 10) {
          that.safeSetBlock(level, x, height - 2, width, height, 20);
        }
      }
    };

    // Mountain Theme: Simple stepping platforms like v1
    this.generateMountainLevel = function(level, width, height, difficulty, difficultyLevel) {
      // Add simple stepped platforms like v1 - very conservative
      const stepCount = 3 + Math.floor(difficulty / 3); // Reduced from /2 to /3 for easier progression
      for (let i = 0; i < stepCount; i++) {
        const stepX = 25 + i * 25;
        const stepY = height - 4 - i; // Only 1 block difference per step
        if (stepY > height - 8) { // Never too high
          for (let j = 0; j < 5; j++) {
            that.safeSetBlock(level, stepX + j, stepY, width, height, 1);
          }
        }
      }
      
      // Add simple pipes on some steps
      if (difficulty > 0) {
        const pipeCount = Math.min(1 + Math.floor(difficulty / 2), 2); // Reduced max pipes from 3 to 2
        for (let i = 0; i < pipeCount; i++) {
          const x = 30 + i * 30;
          if (x + 1 < width - 10) {
            that.safeSetBlock(level, x, height - 2, width, height, 7);
            that.safeSetBlock(level, x + 1, height - 2, width, height, 8);
            that.safeSetBlock(level, x, height - 3, width, height, 9);
            that.safeSetBlock(level, x + 1, height - 3, width, height, 10);
          }
        }
      }
      
      // Add enemies directly on ground level and platforms for guaranteed placement
      const directEnemies = Math.min(5 + difficulty, 8); // Reduced enemies - max 8 instead of 11+
      for (let i = 0; i < directEnemies; i++) {
        const x = 18 + i * 10 + Math.floor(that.seededRandom() * 6); // More spacing between enemies
        if (x < width - 10) {
          that.safeSetBlock(level, x, height - 2, width, height, 20);
        }
      }
      
      // Add strategic gaps between mountain steps like v1 - reduced difficulty
      const mountainGapCount = Math.max(1, Math.floor(difficulty / 3)); // Reduced from /2 to /3
      for (let i = 0; i < mountainGapCount; i++) {
        const gapX = 45 + i * 40 + Math.floor(that.seededRandom() * 8); // More spacing between gaps
        const gapWidth = 2; // Fixed 2-block gaps instead of scaling
        for (let j = 0; j < Math.min(gapWidth, 2); j++) { // Max 2-block gaps
          that.safeSetBlock(level, gapX + j, height - 1, width, height, 0);
        }
      }
      
      // Add some small holes before steps for added challenge - reduced frequency
      for (let i = 0; i < stepCount - 1; i++) {
        if (that.seededRandom() < 0.3) { // Reduced from 60% to 30% chance for holes
          const holeX = 20 + i * 25 + Math.floor(that.seededRandom() * 3);
          that.safeSetBlock(level, holeX, height - 1, width, height, 0);
        }
      }
      
      // Add some enemies on platforms too
      for (let i = 0; i < stepCount && i < 3; i++) {
        const stepX = 27 + i * 25 + Math.floor(that.seededRandom() * 2);
        const stepY = height - 5 - i; // On top of platform
        if (stepY > height - 8) {
          that.safeSetBlock(level, stepX, stepY, width, height, 20);
        }
      }
    };

    // Castle Theme: Defensive wall structures with battlements
    this.generateCastleLevel = function(level, width, height, difficulty, difficultyLevel) {
      // Create castle walls at regular intervals
      const wallCount = 2 + Math.floor(difficulty / 4);
      for (let w = 0; w < wallCount; w++) {
        const wallX = 25 + w * 40;
        const wallHeight = 3 + Math.floor(difficulty / 3);
        const wallWidth = 8 + Math.floor(difficulty / 4);
        
        // Build main wall
        for (let x = 0; x < wallWidth; x++) {
          for (let y = 0; y < wallHeight; y++) {
            that.safeSetBlock(level, wallX + x, height - 1 - y, width, height, 1);
          }
        }
        
        // Add battlements on top
        const battlementY = height - 1 - wallHeight;
        for (let x = 0; x < wallWidth; x += 3) {
          that.safeSetBlock(level, wallX + x, battlementY, width, height, 1);
        }
        
        // Add entrance gap in middle
        const entranceX = wallX + Math.floor(wallWidth / 2);
        that.safeSetBlock(level, entranceX, height - 2, width, height, 0);
      }
    };

    // Bridge Theme: Suspended platforms connected by bridges  
    this.generateBridgeLevel = function(level, width, height, difficulty, difficultyLevel) {
      const bridgeY = Math.max(5, height - 6 - Math.floor(difficulty / 4));
      
      // Create simple bridge platforms
      for (let x = 20; x < width - 20; x += 8) {
        // Bridge platform
        for (let i = 0; i < 4; i++) {
          that.safeSetBlock(level, x + i, bridgeY, width, height, 1);
        }
        
        // Support pillars
        for (let y = bridgeY + 1; y < height - 1; y += 2) {
          that.safeSetBlock(level, x + 1, y, width, height, 1);
        }
      }
      
      // Remove ground under bridges to create gaps
      for (let x = 25; x < width - 25; x++) {
        for (let gap = 0; gap < 2; gap++) {
          that.safeSetBlock(level, x, height - 1 - gap, width, height, 0);
        }
      }
    };

    // Natural enemy placement that avoids getting stuck in structures - more enemies as requested
    this.addNaturalEnemies = function(level, width, height, theme, difficulty) {
      const maxEnemies = Math.min(10 + (difficulty * 2), 20); // 10-20 enemies based on difficulty
      let enemiesPlaced = 0;
      
      // Find all valid enemy positions (on solid ground with clear space above)
      const validPositions = [];
      for (let x = 15; x < width - 15; x++) {
        for (let y = 2; y < height - 1; y++) { // Start from y=2 to avoid boundary issues
          // Check if this is a valid enemy position with proper boundary checks
          if (level[y] && level[y][x] === 0 && // Empty space
              level[y + 1] && level[y + 1][x] !== 0 && // Solid ground below
              level[y - 1] && level[y - 1][x] === 0 && // Clear space above
              level[y - 2] && level[y - 2][x] === 0) { // More clear space above
            validPositions.push({x: x, y: y});
          }
        }
      }
      
      // Place enemies in valid positions with reasonable spacing
      validPositions.sort(() => that.seededRandom() - 0.5); // Randomize
      
      let lastEnemyX = -8; // Reduced spacing for more enemies
      for (let pos of validPositions) {
        if (enemiesPlaced >= maxEnemies) break;
        
        // Ensure enemies aren't too close together but allow more density
        if (pos.x - lastEnemyX > 8) {
          level[pos.y][pos.x] = 20;
          enemiesPlaced++;
          lastEnemyX = pos.x;
        }
      }
      
      // If we still haven't placed enough enemies, force placement on ground level
      let forceAttempts = 0;
      while (enemiesPlaced < maxEnemies && forceAttempts < 50) {
        forceAttempts++;
        const x = 15 + Math.floor(that.seededRandom() * (width - 30));
        const y = height - 2;
        
        // Check if position is empty and on ground
        if (level[y] && level[y][x] === 0 && level[y + 1] && level[y + 1][x] !== 0) {
          // Check spacing from other enemies
          let tooClose = false;
          for (let checkX = Math.max(0, x - 6); checkX <= Math.min(width - 1, x + 6); checkX++) {
            if (level[y] && level[y][checkX] === 20) {
              tooClose = true;
              break;
            }
          }
          
          if (!tooClose) {
            level[y][x] = 20;
            enemiesPlaced++;
          }
        }
      }
    };

    // Add limited question blocks in strategic positions
    this.addLimitedQuestionBlocks = function(level, width, height, maxBlocks) {
      let blocksPlaced = 0;
      const attempts = 50; // Limit attempts to avoid infinite loops
      
      for (let attempt = 0; attempt < attempts && blocksPlaced < maxBlocks; attempt++) {
        const x = 20 + Math.floor(that.seededRandom() * (width - 40));
        const y = 3 + Math.floor(that.seededRandom() * (height - 8));
        
        // Check if position is good for a question block with boundary checks
        if (level[y] && level[y][x] === 0 && // Empty space
            level[y + 1] && level[y + 1][x] === 0 && // Space below (so Mario can reach it by jumping)
            level[y + 2] && level[y + 2][x] === 0 && // More space below
            level[y + 3] && level[y + 3][x] !== 0) { // But has platform support further down
          
          level[y][x] = 3;
          blocksPlaced++;
        }
      }
    };

    // Maze Theme: Simple maze with pipes - simplified for safety
    this.generateMazeLevel = function(level, width, height, difficulty, difficultyLevel) {
      // Create horizontal platforms at different heights
      for (let platformLevel = 0; platformLevel < 3; platformLevel++) {
        const y = height - 4 - platformLevel * 3;
        for (let x = 15; x < width - 15; x += 10) {
          for (let w = 0; w < 4; w++) {
            that.safeSetBlock(level, x + w, y, width, height, 1);
          }
        }
      }
      
      // Add simple pipes
      for (let x = 20; x < width - 20; x += 20) {
        const pipeHeight = 1; // Always 1 block high to ensure easy navigation
        for (let h = 0; h < pipeHeight; h++) {
          that.safeSetBlock(level, x, height - 2 - h, width, height, 7);
          that.safeSetBlock(level, x + 1, height - 2 - h, width, height, 8);
        }
        // Add pipe top
        that.safeSetBlock(level, x, height - 2 - pipeHeight, width, height, 9);
        that.safeSetBlock(level, x + 1, height - 2 - pipeHeight, width, height, 10);
      }
    };

    // Parkour Theme: Precise jumping challenges - simplified for safety
    this.generateParkourLevel = function(level, width, height, difficulty, difficultyLevel) {
      // Create small platforms for precise jumping
      const platformCount = 8 + Math.floor(difficulty / 2);
      
      for (let i = 0; i < platformCount; i++) {
        const x = 20 + i * 12;
        const y = Math.max(5, height - 5 - Math.floor(difficulty / 6));
        const size = Math.max(2, 4 - Math.floor(difficulty / 8));
        
        for (let j = 0; j < size; j++) {
          that.safeSetBlock(level, x + j, y, width, height, 4);
        }
      }
      
      // Add ground gaps
      for (let gap = 0; gap < 4; gap++) {
        const gapX = 35 + gap * 25;
        for (let w = 0; w < 4; w++) {
          that.safeSetBlock(level, gapX + w, height - 1, width, height, 0);
        }
      }
    };

    // Fortress Theme: Simple fortress structures - simplified for safety
    this.generateFortressLevel = function(level, width, height, difficulty, difficultyLevel) {
      // Create simple fortress walls
      for (let x = 25; x < width - 25; x += 30) {
        const wallHeight = 3 + Math.floor(difficulty / 4);
        for (let h = 0; h < wallHeight; h++) {
          that.safeSetBlock(level, x, height - 2 - h, width, height, 1);
          that.safeSetBlock(level, x + 8, height - 2 - h, width, height, 1);
        }
        // Add entrance gap
        that.safeSetBlock(level, x + 4, height - 2, width, height, 0);
      }
    };

    // Sky Theme: Floating platforms - simplified for safety  
    this.generateSkyLevel = function(level, width, height, difficulty, difficultyLevel) {
      // Remove ground in middle
      for (let x = 30; x < width - 30; x++) {
        that.safeSetBlock(level, x, height - 1, width, height, 0);
      }
      
      // Create floating platforms
      for (let x = 25; x < width - 25; x += 15) {
        const platY = Math.max(5, height - 8 - Math.floor(difficulty / 3));
        for (let w = 0; w < 4; w++) {
          that.safeSetBlock(level, x + w, platY, width, height, 1);
        }
      }
    };

    // Cavern Theme: Irregular cave structure - simplified for safety
    this.generateCavernLevel = function(level, width, height, difficulty, difficultyLevel) {
      // Create irregular ceiling
      for (let x = 15; x < width - 15; x += 3) {
        const ceilingHeight = 2 + Math.floor(that.seededRandom() * 2);
        for (let y = 0; y < ceilingHeight; y++) {
          that.safeSetBlock(level, x, y, width, height, 1);
        }
      }
      
      // Add middle platforms
      for (let x = 25; x < width - 25; x += 20) {
        const platY = Math.max(6, height - 8);
        for (let w = 0; w < 5; w++) {
          that.safeSetBlock(level, x + w, platY, width, height, 1);
        }
      }
    };

    this.addSimplePlatforms = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 30)) + 15;
        const y = Math.floor(that.seededRandom() * 4) + 9;
        const length = Math.floor(that.seededRandom() * 6) + 4;
        
        for (let j = 0; j < length && x + j < width - 5; j++) {
          if (x + j >= 0 && x + j < width && y >= 0 && y < height) {
            level[y][x + j] = 1;
          }
        }
      }
    };

    this.addVariedPlatforms = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 30)) + 15;
        const y = Math.floor(that.seededRandom() * 6) + 7;
        const length = Math.floor(that.seededRandom() * 8) + 3;
        const platformType = that.seededRandom();
        
        if (platformType < 0.7) {
          for (let j = 0; j < length && x + j < width - 5; j++) {
            if (x + j >= 0 && x + j < width && y >= 0 && y < height) {
              level[y][x + j] = 1;
            }
          }
        } else {
          // Limited to max 2 blocks high to prevent blocking Mario
          for (let j = 0; j < Math.min(length, 3) && x + j < width - 5; j++) {
            for (let k = 0; k < Math.min(2, 2) && y + k < height - 1; k++) { // Max 2 blocks high
              if (x + j >= 0 && x + j < width && y + k >= 0 && y + k < height) {
                level[y + k][x + j] = 1;
              }
            }
          }
        }
      }
    };

    this.addComplexPlatforms = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 35)) + 15;
        const y = Math.floor(that.seededRandom() * 5) + 5;
        const pattern = Math.floor(that.seededRandom() * 3);
        
        if (pattern === 0) {
          for (let j = 0; j < 6 && x + j < width - 5; j++) {
            if (y >= 0 && y < height && x + j >= 0 && x + j < width) {
              level[y][x + j] = 1;
            }
            if (j % 2 === 1 && y - 1 >= 0 && y - 1 < height && x + j >= 0 && x + j < width) {
              level[y - 1][x + j] = 1;
            }
          }
        } else if (pattern === 1) {
          // Limited block structure - max 2x2 to prevent blocking
          for (let j = 0; j < Math.min(2, 2) && y + j < height - 1; j++) {
            for (let k = 0; k < Math.min(2, 2) && x + k < width - 5; k++) {
              if (y + j >= 0 && y + j < height && x + k >= 0 && x + k < width) {
                level[y + j][x + k] = 1;
              }
            }
          }
        } else {
          // Limited staircase - max 3 steps to prevent blocking Mario
          const stairLength = Math.min(3, 3);
          for (let j = 0; j < stairLength && x + j < width - 5; j++) {
            for (let k = 0; k <= Math.min(j, 2) && y + k < height - 1; k++) { // Max 3 blocks high
              if (y + k >= 0 && y + k < height && x + j >= 0 && x + j < width) {
                level[y + k][x + j] = 1;
              }
            }
          }
        }
      }
    };

    this.addBasicEnemies = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 20)) + 10;
        const y = height - 2;
        if (x >= 0 && x < width && y >= 0 && y < height && y + 1 < height &&
            level[y + 1][x] === 1 && level[y][x] === 0) {
          level[y][x] = 20;
        }
      }
    };

    this.addAdvancedEnemies = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 20)) + 10;
        let y = height - 2;
        
        for (let checkY = height - 2; checkY >= 1; checkY--) {
          if (x >= 0 && x < width && checkY >= 0 && checkY < height && 
              checkY + 1 < height && level[checkY + 1][x] !== 0 && level[checkY][x] === 0) {
            y = checkY;
            break;
          }
        }
        
        if (x >= 0 && x < width && y >= 0 && y < height && y + 1 < height &&
            level[y + 1][x] !== 0 && level[y][x] === 0) {
          level[y][x] = 20;
        }
      }
    };

    this.addSmallGaps = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 25)) + 10;
        const gapWidth = Math.min(Math.floor(that.seededRandom() * 2) + 2, 3); // Max 3 blocks
        
        for (let j = 0; j < gapWidth && x + j < width - 10; j++) {
          if (x + j >= 0 && x + j < width) {
            level[height - 1][x + j] = 0;
          }
        }
        
        // Add stepping stone for gaps of 3
        if (gapWidth === 3) {
          const stoneY = height - 4;
          const stoneX = x + 1;
          if (stoneX < width - 10 && stoneY >= 0) {
            level[stoneY][stoneX] = 4;
          }
        }
      }
    };

    this.addMediumGaps = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 30)) + 15;
        const gapWidth = Math.min(Math.floor(that.seededRandom() * 3) + 3, 4); // Max 4 blocks
        
        for (let j = 0; j < gapWidth && x + j < width - 10; j++) {
          if (x + j >= 0 && x + j < width) {
            level[height - 1][x + j] = 0;
          }
        }
        
        // Always add platform for medium gaps
        const platformY = height - 4;
        const platformX = x + Math.floor(gapWidth / 2);
        if (platformX < width - 10 && platformY >= 0) {
          level[platformY][platformX] = 4;
          level[platformY][platformX + 1] = 4;
        }
      }
    };

    this.addLargeGaps = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 35)) + 20;
        const gapWidth = Math.min(Math.floor(that.seededRandom() * 3) + 4, 6); // Max 6 blocks
        
        for (let j = 0; j < gapWidth && x + j < width - 15; j++) {
          if (x + j >= 0 && x + j < width) {
            level[height - 1][x + j] = 0;
          }
        }
        
        // Always add platforms for large gaps - ensure passability
        const firstPlatY = height - 4;
        const secondPlatY = height - 6;
        const firstPlatX = x + 1;
        const secondPlatX = x + gapWidth - 2;
        
        if (firstPlatX < width - 10 && firstPlatY >= 0) {
          level[firstPlatY][firstPlatX] = 4;
          level[firstPlatY][firstPlatX + 1] = 4;
        }
        if (secondPlatX < width - 10 && secondPlatY >= 0) {
          level[secondPlatY][secondPlatX] = 4;
          level[secondPlatY][secondPlatX + 1] = 4;
        }
      }
    };

    this.addPipes = function(level, width, height, count) {
      // Significantly increased pipe count for v1-like levels
      const actualCount = count * 2; // Double the pipe count
      for (let i = 0; i < actualCount; i++) {
        const x = Math.floor(that.seededRandom() * (width - 25)) + 10;
        const pipeHeight = 1; // Always 1 block high to ensure easy navigation
        
        if (x + 1 < width - 10) {
          // Build pipe from bottom up
          for (let j = 0; j < pipeHeight; j++) {
            const y = height - 2 - j;
            if (y >= 0) {
              level[y][x] = 7;
              level[y][x + 1] = 8;
            }
          }
          // Add pipe top
          const topY = height - 2 - pipeHeight;
          if (topY >= 0) {
            level[topY][x] = 9;
            level[topY][x + 1] = 10;
          }
          
          // Add enemies on some pipes like v1
          if (that.seededRandom() < 0.3 && topY - 1 >= 0) {
            level[topY - 1][x] = 20;
          }
        }
      }
    };

    this.addObstacles = function(level, width, height, difficulty) {
      const obstacleCount = Math.floor(difficulty / 2);
      for (let i = 0; i < obstacleCount; i++) {
        const x = Math.floor(that.seededRandom() * (width - 15)) + 5;
        const y = Math.floor(that.seededRandom() * 3) + 8;
        
        if (x >= 0 && x < width && y >= 0 && y < height && y + 1 < height &&
            level[y][x] === 0 && level[y + 1][x] !== 0) {
          level[y][x] = 4;
        }
      }
    };

    this.addMovingPlatforms = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 20)) + 10;
        const y = Math.floor(that.seededRandom() * 4) + 8;
        
        if (x >= 0 && x + 1 < width && y >= 0 && y < height) {
          level[y][x] = 4;
          level[y][x + 1] = 4;
        }
      }
    };

    this.addHazards = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(that.seededRandom() * (width - 15)) + 5;
        const y = height - 2;
        
        if (x >= 0 && x < width && y >= 0 && y < height && y + 1 < height &&
            level[y + 1][x] === 1 && level[y][x] === 0) {
          level[y][x] = that.seededRandom() < 0.5 ? 20 : 4;
        }
      }
    };

    this.addCoins = function(level, width, height, density, strategic, difficulty) {
      const totalCoins = Math.max(10, Math.min(15, Math.floor(width * density))); // Ensure 10-15 coins
      const heightOffset = Math.min(difficulty || 0, 4); // Progressive difficulty
      
      for (let i = 0; i < totalCoins; i++) {
        let x, y;
        
        if (strategic) {
          x = Math.floor(that.seededRandom() * (width - 10)) + 5;
          y = Math.floor(that.seededRandom() * (height - 5 - heightOffset)) + 1;
          
          if (x >= 0 && x < width && y >= 0 && y < height && level[y][x] === 0) {
            let hasSupport = false;
            let supportDistance = 4 + heightOffset; // Coins get higher with difficulty
            for (let checkY = y + 1; checkY < height && checkY <= y + supportDistance; checkY++) {
              if (checkY < height && level[checkY][x] !== 0) {
                hasSupport = true;
                break;
              }
            }
            if (hasSupport) {
              level[y][x] = 2;
              // More question blocks at higher difficulties
              if (that.seededRandom() < 0.2 + (heightOffset * 0.1)) {
                level[y][x] = 3;
              }
            }
          }
        } else {
          x = Math.floor(that.seededRandom() * (width - 10)) + 5;
          y = Math.floor(that.seededRandom() * (height - 5 - heightOffset)) + 1;
          
          if (x >= 0 && x < width && y >= 0 && y < height && y + 4 + heightOffset < height &&
              level[y][x] === 0 && level[y + 4 + heightOffset][x] !== 0) {
            level[y][x] = 2;
          }
        }
      }
    };

    // New section-based platform creation functions
    this.createBasicPlatformSection = function(level, startX, endX, height, sectionIndex) {
      const sectionWidth = endX - startX;
      const platformY = height - 3 - (sectionIndex % 3);
      const platformLength = 4 + Math.floor(that.seededRandom() * 4);
      const platformX = startX + Math.floor(that.seededRandom() * (sectionWidth - platformLength));
      
      for (let i = 0; i < platformLength && platformX + i < endX; i++) {
        if (platformX + i >= startX && platformY >= 0) {
          level[platformY][platformX + i] = 1;
        }
      }
      
      // Coins will be added centrally by addCoinsToLevel function
    };
    
    this.createIntermediatePlatformSection = function(level, startX, endX, height, sectionIndex) {
      const sectionWidth = endX - startX;
      
      // Create tiered platforms
      for (let tier = 0; tier < 2; tier++) {
        const platformY = height - 4 - tier * 2 - (sectionIndex % 2);
        const platformLength = 3 + Math.floor(that.seededRandom() * 3);
        const platformX = startX + Math.floor(that.seededRandom() * (sectionWidth - platformLength));
        
        for (let i = 0; i < platformLength && platformX + i < endX; i++) {
          if (platformX + i >= startX && platformY >= 0) {
            level[platformY][platformX + i] = 1;
          }
        }
        
        // Question blocks only - coins added centrally
        if (tier === 1 && platformX + 1 < endX && platformY - 5 >= 0) {
          level[platformY - 5][platformX + 1] = 3;
        }
      }
    };
    
    this.createAdvancedPlatformSection = function(level, startX, endX, height, sectionIndex) {
      const sectionWidth = endX - startX;
      
      // Create complex multi-level structures - limited to 2 tiers to prevent blocking
      for (let tier = 0; tier < Math.min(2, 2); tier++) {
        const platformY = height - 5 - tier * 3; // Increased spacing between tiers
        const platformLength = 2 + Math.floor(that.seededRandom() * 4);
        const platformX = startX + Math.floor(that.seededRandom() * (sectionWidth - platformLength));
        
        for (let i = 0; i < platformLength && platformX + i < endX; i++) {
          if (platformX + i >= startX && platformY >= 0) {
            level[platformY][platformX + i] = tier < 1 ? 1 : 4; // Use bricks for top tier
          }
        }
        
        // Strategic question block placement - coins added centrally
        if (tier === 0 && platformX + 1 < endX && platformY - 5 >= 0) {
          level[platformY - 5][platformX + 1] = 3; // Question block - proper jump height
        }
      }
      
      // Add a small pipe if space allows
      if (sectionIndex % 2 === 0 && startX + 3 < endX) {
        const pipeX = startX + 2;
        level[height - 2][pipeX] = 7;
        level[height - 2][pipeX + 1] = 8;
        level[height - 3][pipeX] = 9;
        level[height - 3][pipeX + 1] = 10;
      }
    };
    
    this.createExpertPlatformSection = function(level, startX, endX, height, sectionIndex) {
      // Create challenging sequences with precise jumps
      const challengeType = Math.floor(that.seededRandom() * 3);
      
      if (challengeType === 0) {
        // Passable staircase challenge - limited to 2 steps max with wider spacing
        for (let i = 0; i < 2; i++) {
          const stepX = startX + i * 5; // Much more spacing for easier navigation
          const stepY = height - 3 - i; // Even gentler slope, never above 2 blocks
          if (stepX < endX - 3 && stepY >= 0) {
            level[stepY][stepX] = 1;
            level[stepY][stepX + 1] = 1;
            level[stepY][stepX + 2] = 1; // Wider platforms for easier landing
          }
        }
      } else if (challengeType === 1) {
        // Floating platforms with manageable gaps
        for (let i = 0; i < 3; i++) {
          const platformX = startX + i * 4 + 1; // Closer platforms
          const platformY = height - 6 + (i % 2);
          if (platformX < endX - 2 && platformY >= 0) {
            level[platformY][platformX] = 4;
            level[platformY][platformX + 1] = 4;
            level[platformY][platformX + 2] = 4; // Wider platforms
          }
        }
      } else {
        // Mixed structure with blocks - coins added centrally
        const baseY = height - 5;
        for (let i = 0; i < 6 && startX + i < endX; i++) {
          if (baseY >= 0) {
            level[baseY][startX + i] = i % 3 === 1 ? 4 : 1;
          }
        }
      }
    };
    
    this.addMeaningfulGaps = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const gapX = 20 + Math.floor(that.seededRandom() * (width - 50));
        const gapWidth = 3 + Math.floor(that.seededRandom() * 3);
        
        // Create gap in ground
        for (let j = 0; j < gapWidth; j++) {
          if (gapX + j < width - 10) {
            level[height - 1][gapX + j] = 0;
          }
        }
        
        // Add platforms to help cross
        if (gapWidth > 4) {
          const platformY = height - 4;
          const platformX = gapX + Math.floor(gapWidth / 2);
          if (platformX < width - 10 && platformY >= 0) {
            level[platformY][platformX] = 4;
            level[platformY][platformX + 1] = 4;
          }
        }
      }
    };
    
    this.addStrategicEnemies = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        let placed = false;
        
        // Try to place enemies on platforms first, with better distribution
        for (let attempt = 0; attempt < 15 && !placed; attempt++) {
          const x = Math.floor(that.seededRandom() * (width - 25)) + 10;
          
          for (let y = height - 2; y >= 1; y--) {
            if (level[y + 1][x] !== 0 && level[y][x] === 0) {
              level[y][x] = 20;
              placed = true;
              break;
            }
          }
        }
        
        // If still not placed, force placement on ground with spacing
        if (!placed) {
          const x = 15 + (i * 12) + Math.floor(that.seededRandom() * 8);
          if (x < width - 10 && level[height - 2][x] === 0) {
            level[height - 2][x] = 20;
          }
        }
      }
    };
    
    this.addPathCoins = function(level, width, height, difficulty) {
      // Add coins along the natural path of the level
      const heightOffset = Math.min(Math.floor(difficulty / 2), 3);
      const spacing = Math.max(8 - Math.floor(difficulty / 3), 5); // Coins get sparser
      
      for (let x = 10; x < width - 10; x += spacing) {
        let coinPlaced = false;
        
        // Look for platforms and place coins higher as difficulty increases
        const minDistance = 4 + heightOffset;
        const maxDistance = 5 + heightOffset;
        
        for (let y = height - 2; y >= minDistance + 1 && !coinPlaced; y--) {
          if (level[y + 1][x] !== 0 && level[y][x] === 0 && 
              level[y - minDistance][x] === 0 && level[y - maxDistance][x] === 0) {
            level[y - minDistance][x] = 2; // Place coin higher with difficulty
            coinPlaced = true;
          }
        }
        
        // If no platform found, place coin at challenging height
        if (!coinPlaced && that.seededRandom() < (0.3 - difficulty * 0.02)) {
          const coinY = height - (9 + heightOffset);
          if (coinY >= 0 && level[coinY][x] === 0) {
            level[coinY][x] = 2;
          }
        }
      }
    };
    
    this.createMultiLevelStructures = function(level, width, height, complexity) {
      const structureCount = 2 + complexity;
      
      for (let i = 0; i < structureCount; i++) {
        const baseX = 15 + Math.floor(that.seededRandom() * (width - 40));
        const structureWidth = 8 + Math.floor(that.seededRandom() * 6);
        const levels = Math.min(3, 2 + Math.floor(that.seededRandom() * 1)); // Max 3 levels
        
        // Build from bottom up
        for (let level_idx = 0; level_idx < levels; level_idx++) {
          const levelY = height - 3 - level_idx * 3;
          const levelWidth = structureWidth - level_idx;
          
          for (let j = 0; j < levelWidth && baseX + j < width - 10; j++) {
            if (levelY >= 0) {
              level[levelY][baseX + j] = level_idx === levels - 1 ? 4 : 1;
            }
          }
          
          // Add details to each level - higher placement
          if (level_idx > 0 && baseX + 2 < width - 10) {
            if (levelY - 6 >= 0) {
              level[levelY - 6][baseX + 2] = level_idx % 2 === 0 ? 2 : 3; // 6 blocks above platform
            }
          }
        }
      }
    };
    
    this.addPipeNetworks = function(level, width, height, count) {
      // Create pipe networks like v1 static levels - much more extensive
      const sections = 3;
      for (let section = 0; section < sections; section++) {
        const sectionStart = Math.floor((width - 30) / sections * section) + 15;
        const sectionEnd = Math.floor((width - 30) / sections * (section + 1)) + 15;
        const pipesPerSection = Math.floor(count / sections) + 1;
        
        for (let i = 0; i < pipesPerSection; i++) {
          const pipeX = sectionStart + Math.floor(that.seededRandom() * (sectionEnd - sectionStart - 10));
          const pipeHeight = 1; // Always 1 block high to ensure easy navigation
          
          if (pipeX + 1 < width - 10) {
            // Build pipe body
            for (let j = 0; j < pipeHeight; j++) {
              const y = height - 2 - j;
              if (y >= 0) {
                level[y][pipeX] = 7;
                level[y][pipeX + 1] = 8;
              }
            }
            
            // Add pipe top
            const topY = height - 2 - pipeHeight;
            if (topY >= 0) {
              level[topY][pipeX] = 9;
              level[topY][pipeX + 1] = 10;
            }
            
            // Coins will be added centrally by addCoinsToLevel function
          }
        }
      }
    };
    
    this.addFloatingPlatformChallenges = function(level, width, height, complexity) {
      const challengeCount = 1 + complexity;
      
      for (let i = 0; i < challengeCount; i++) {
        const startX = 25 + Math.floor(that.seededRandom() * (width - 60));
        const platformCount = 3 + Math.floor(that.seededRandom() * 3);
        
        for (let j = 0; j < platformCount; j++) {
          const platformX = startX + j * 6;
          const platformY = height - 6 + Math.floor(that.seededRandom() * 3);
          const platformLength = 2 + Math.floor(that.seededRandom() * 2);
          
          if (platformX < width - 10 && platformY >= 0) {
            for (let k = 0; k < platformLength && platformX + k < width - 10; k++) {
              level[platformY][platformX + k] = 4;
            }
          }
        }
      }
    };
    
    this.addElevatedEnemies = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        let placed = false;
        
        for (let attempt = 0; attempt < 20 && !placed; attempt++) {
          const x = Math.floor(that.seededRandom() * (width - 25)) + 10;
          
          // Look for platforms above ground level with better spacing
          for (let y = height - 5; y >= 3; y--) {
            if (level[y + 1][x] !== 0 && level[y][x] === 0) {
              level[y][x] = 20;
              placed = true;
              break;
            }
          }
        }
        
        // Fallback to ground placement with good spacing
        if (!placed) {
          const x = 20 + (i * 15) + Math.floor(that.seededRandom() * 10);
          if (x < width - 10 && level[height - 2][x] === 0) {
            level[height - 2][x] = 20;
          }
        }
      }
    };
    
    this.addChallengeGaps = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const gapX = 30 + Math.floor(that.seededRandom() * (width - 70));
        const gapWidth = 4 + Math.floor(that.seededRandom() * 4);
        
        // Create gap
        for (let j = 0; j < gapWidth; j++) {
          if (gapX + j < width - 10) {
            level[height - 1][gapX + j] = 0;
          }
        }
        
        // Add challenge platforms
        const midPlatformX = gapX + Math.floor(gapWidth / 2);
        const platformY = height - 5;
        if (midPlatformX < width - 10 && platformY >= 0) {
          level[platformY][midPlatformX] = 4;
          // Coins will be added centrally by addCoinsToLevel function
        }
      }
    };
    
    this.addGuidingCoins = function(level, width, height, difficulty) {
      // Place coins to show optimal path through challenges
      const spacing = 10 + Math.floor(difficulty / 2); // Wider spacing for harder levels
      const heightOffset = Math.min(difficulty, 4);
      
      for (let x = 15; x < width - 15; x += spacing) {
        let bestY = -1;
        let hasPath = false;
        
        // Find accessible position higher up as difficulty increases
        const minDistance = 4 + heightOffset;
        const maxDistance = 6 + heightOffset;
        
        for (let y = height - 10; y >= minDistance; y--) {
          if (level[y][x] === 0) {
            // Check if there's a platform further below
            for (let checkY = y + minDistance; checkY <= y + maxDistance && checkY < height; checkY++) {
              if (level[checkY][x] !== 0) {
                bestY = y;
                hasPath = true;
                break;
              }
            }
          }
          if (hasPath) break;
        }
        
        // Reduce coin frequency for harder levels
        const coinChance = 0.5 - (difficulty * 0.03);
        if (bestY >= 0 && that.seededRandom() < coinChance) {
          level[bestY][x] = 2;
        }
      }
    };
    
    this.addStrategicQuestionBlocks = function(level, width, height, complexity) {
      const blockCount = 1 + complexity;
      
      for (let i = 0; i < blockCount; i++) {
        let placed = false;
        
        for (let attempt = 0; attempt < 10 && !placed; attempt++) {
          const x = Math.floor(that.seededRandom() * (width - 20)) + 10;
          
          // Look for platforms and place question blocks 5-6 blocks above them
          for (let y = height - 2; y >= 6; y--) {
            if (level[y][x] !== 0 && level[y - 5][x] === 0 && level[y - 6][x] === 0) {
              // Check for vertical conflicts before placing question block
              let hasVerticalConflict = false;
              const blockY = y - 5;
              for (let checkY = Math.max(0, blockY - 3); checkY <= Math.min(height - 1, blockY + 3); checkY++) {
                if (checkY !== blockY && level[checkY] && (level[checkY][x] === 2 || level[checkY][x] === 3)) {
                  hasVerticalConflict = true;
                  break;
                }
              }
              
              if (!hasVerticalConflict) {
                level[blockY][x] = 3; // 5 blocks above platform - good jump height
                placed = true;
                break;
              }
            }
          }
          
          // If no platform found, try ground level placement
          if (!placed) {
            const groundY = height - 11; // 11 blocks above ground - much higher
            if (groundY >= 0 && level[groundY][x] === 0) {
              // Check for vertical conflicts before placing ground-level question block
              let hasVerticalConflict = false;
              for (let checkY = Math.max(0, groundY - 3); checkY <= Math.min(height - 1, groundY + 3); checkY++) {
                if (checkY !== groundY && level[checkY] && (level[checkY][x] === 2 || level[checkY][x] === 3)) {
                  hasVerticalConflict = true;
                  break;
                }
              }
              
              if (!hasVerticalConflict) {
                level[groundY][x] = 3;
                placed = true;
              }
            }
          }
        }
      }
    };
    
    this.addMovingElements = function(level, width, height, complexity) {
      const elementCount = Math.floor(complexity / 2);
      
      for (let i = 0; i < elementCount; i++) {
        const x = 20 + Math.floor(that.seededRandom() * (width - 50));
        const y = height - 8 + Math.floor(that.seededRandom() * 3);
        
        if (x + 1 < width - 10 && y >= 0) {
          level[y][x] = 4;
          level[y][x + 1] = 4;
        }
      }
    };

    // Advanced level generation functions
    this.createCastleStructures = function(level, width, height, difficulty) {
      const castleCount = 1 + Math.floor(difficulty / 3);
      
      for (let i = 0; i < castleCount; i++) {
        const castleX = 20 + Math.floor(that.seededRandom() * (width - 60));
        const castleWidth = 10 + Math.floor(that.seededRandom() * 8);
        const castleHeight = Math.min(4, 2 + Math.floor(that.seededRandom() * 2)); // Max 4 blocks high
        
        // Build castle walls
        for (let wall = 0; wall < castleHeight; wall++) {
          const wallY = height - 2 - wall;
          if (wallY >= 0) {
            // Left wall
            level[wallY][castleX] = 1;
            // Right wall  
            if (castleX + castleWidth < width - 10) {
              level[wallY][castleX + castleWidth] = 1;
            }
            
            // Battlements on top
            if (wall === castleHeight - 1) {
              for (let j = 1; j < castleWidth; j += 3) {
                if (castleX + j < width - 10) {
                  level[wallY][castleX + j] = 1;
                }
              }
            }
          }
        }
        
        // Add entrance gap
        const entranceY = height - 2;
        const entranceX = castleX + Math.floor(castleWidth / 2);
        if (entranceY >= 0 && entranceX < width - 10) {
          level[entranceY][entranceX] = 0;
          level[entranceY][entranceX + 1] = 0;
        }
      }
    };
    
    this.addPipeMazes = function(level, width, height, count) {
      // Create extensive pipe mazes like v1 static levels
      for (let i = 0; i < count; i++) {
        const mazeX = 25 + Math.floor(that.seededRandom() * (width - 70));
        const pipeCount = 5 + Math.floor(that.seededRandom() * 4); // More pipes per maze
        
        for (let j = 0; j < pipeCount; j++) {
          const pipeX = mazeX + j * 6; // Closer spacing like v1
          const pipeHeight = 1; // Always 1 block high to ensure easy navigation
          
          if (pipeX + 1 < width - 10) {
            // Build pipe body
            for (let h = 0; h < pipeHeight; h++) {
              const y = height - 2 - h;
              if (y >= 0) {
                level[y][pipeX] = 7;
                level[y][pipeX + 1] = 8;
              }
            }
            
            // Add pipe top
            const topY = height - 2 - pipeHeight;
            if (topY >= 0) {
              level[topY][pipeX] = 9;
              level[topY][pipeX + 1] = 10;
            }
            
            // Add enemies on some pipes like v1 (but pipes are now max 2 blocks so this is safe)
            if (pipeHeight >= 1 && that.seededRandom() < 0.4 && topY - 1 >= 0) {
              level[topY - 1][pipeX] = 20;
            }
            
            // Create gaps between some pipe groups - v1 style
            if (j % 3 === 2 && mazeX + (j + 1) * 6 + 3 < width - 10) {
              for (let gapJ = 0; gapJ < 2; gapJ++) {
                const gapX = mazeX + (j + 1) * 6 + gapJ;
                if (gapX < width - 10) {
                  level[height - 1][gapX] = 0;
                }
              }
            }
          }
        }
      }
    };
    
    this.addPrecisionChallenges = function(level, width, height, difficulty) {
      const challengeCount = 1 + difficulty;
      
      for (let i = 0; i < challengeCount; i++) {
        const startX = 25 + Math.floor(that.seededRandom() * (width - 60));
        const platformSpacing = 4 + Math.floor(that.seededRandom() * 3);
        
        // Create series of small platforms requiring precise jumps
        for (let j = 0; j < 5; j++) {
          const platformX = startX + j * platformSpacing;
          const platformY = height - 7 + Math.floor(that.seededRandom() * 2);
          
          if (platformX < width - 10 && platformY >= 0) {
            level[platformY][platformX] = 4;
            
            // Coins will be added centrally by addCoinsToLevel function
          }
        }
      }
    };
    
    this.addEnemyFormations = function(level, width, height, count) {
      const formations = Math.floor(count / 2);
      
      for (let i = 0; i < formations; i++) {
        const formationX = 20 + Math.floor(that.seededRandom() * (width - 50));
        const formationType = Math.floor(that.seededRandom() * 3);
        
        if (formationType === 0) {
          // Line formation
          for (let j = 0; j < 3; j++) {
            const x = formationX + j * 4;
            if (x < width - 10) {
              level[height - 2][x] = 20;
            }
          }
        } else if (formationType === 1) {
          // Limited stacked formation - max 2 enemies vertically
          const x = formationX;
          if (x < width - 10) {
            level[height - 2][x] = 20;
            // Only add second enemy if there's platform support above
            if (height - 3 >= 0) {
              level[height - 3][x] = 20;
            }
          }
        } else {
          // Scattered formation on platforms - more enemies
          for (let j = 0; j < 6; j++) {
            const x = formationX + Math.floor(that.seededRandom() * 20);
            if (x < width - 10) {
              // Find suitable platform
              for (let y = height - 2; y >= 3; y--) {
                if (level[y + 1][x] !== 0 && level[y][x] === 0) {
                  level[y][x] = 20;
                  break;
                }
              }
            }
          }
        }
      }
    };
    
    this.addExpertGaps = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const gapX = 40 + Math.floor(that.seededRandom() * (width - 90));
        const gapWidth = 5 + Math.floor(that.seededRandom() * 5);
        
        // Create challenging gap
        for (let j = 0; j < gapWidth; j++) {
          if (gapX + j < width - 10) {
            level[height - 1][gapX + j] = 0;
          }
        }
        
        // Add multiple solution paths
        const solutions = 1 + Math.floor(that.seededRandom() * 2);
        for (let sol = 0; sol < solutions; sol++) {
          const platX = gapX + 2 + sol * 3;
          const platY = height - 4 - sol;
          
          if (platX < width - 10 && platY >= 0) {
            level[platY][platX] = 4;
            level[platY][platX + 1] = 4;
          }
        }
      }
    };
    
    this.addDynamicPlatforms = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = 30 + Math.floor(that.seededRandom() * (width - 70));
        const y = height - 6 + Math.floor(that.seededRandom() * 2);
        
        if (x + 2 < width - 10 && y >= 0) {
          level[y][x] = 4;
          level[y][x + 1] = 4;
          level[y][x + 2] = 4;
        }
      }
    };
    
    this.addAdvancedPickups = function(level, width, height, difficulty) {
      const pickupCount = 2 + difficulty;
      
      for (let i = 0; i < pickupCount; i++) {
        const x = 20 + Math.floor(that.seededRandom() * (width - 40));
        const y = height - 8 + Math.floor(that.seededRandom() * 3);
        
        if (x < width - 10 && y >= 0 && level[y][x] === 0) {
          level[y][x] = that.seededRandom() < 0.7 ? 3 : 2;
        }
      }
    };
    
    this.addEnvironmentalHazards = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const x = 25 + Math.floor(that.seededRandom() * (width - 50));
        const hazardType = Math.floor(that.seededRandom() * 2);
        
        if (x < width - 10) {
          if (hazardType === 0) {
            // Spikes on ground
            level[height - 2][x] = 4;
          } else {
            // Hanging obstacle - placed higher to not block Mario
            const y = height - 8;
            if (y >= 0) {
              level[y][x] = 4;
            }
          }
        }
      }
    };

    // Centralized coin placement function - simple like v1, accessible coins
    this.addCoinsToLevel = function(level, width, height, levelNumber) {
      const targetCoins = 8 + Math.floor(that.seededRandom() * 5); // 8-12 coins like v1
      const difficulty = Math.floor((levelNumber - 1) / 7); // Same difficulty calculation as level generation
      let coinsPlaced = 0;
      const maxAttempts = 500; // Fewer attempts, simpler placement
      let attempts = 0;
      
      // v1-style simple coin placement - always accessible
      const minHeight = 3; // Fixed minimum height
      const maxSupportDistance = 5; // Fixed support distance
      const preferHigherPlacement = 0; // No preference for high placement
      
      while (coinsPlaced < targetCoins && attempts < maxAttempts) {
        attempts++;
        
        const x = 15 + Math.floor(that.seededRandom() * (width - 30));
        const y = height - 12 + Math.floor(that.seededRandom() * 3); // Higher placement - 12, 11, or 10 blocks from ground
        
        // Check if position is empty and has support below
        if (level[y] && level[y][x] === 0) {
          let hasSupport = false;
          let hasVerticalConflict = false;
          
          // Look for support below (platform or ground) - simple check
          for (let checkY = y + 1; checkY < height && checkY <= y + maxSupportDistance; checkY++) {
            if (level[checkY] && level[checkY][x] !== 0) {
              hasSupport = true;
              break;
            }
          }
          
          // Check for coins/question blocks above or below (prevent stacking)
          for (let checkY = Math.max(0, y - 3); checkY <= Math.min(height - 1, y + 3); checkY++) {
            if (checkY !== y && level[checkY] && (level[checkY][x] === 2 || level[checkY][x] === 3)) {
              hasVerticalConflict = true;
              break;
            }
          }
          
          // Place coin if there's support, it's reachable, and no vertical stacking
          if (hasSupport && !hasVerticalConflict) {
            level[y][x] = 2; // Always regular coin, simple like v1
            coinsPlaced++;
          }
        }
      }
      
      // If we couldn't place enough coins naturally, force simple placement
      let fallbackAttempts = 0;
      while (coinsPlaced < 6 && fallbackAttempts < 50) {
        fallbackAttempts++;
        const x = 20 + (coinsPlaced * 12) % (width - 40);
        const y = height - 10; // Higher fixed height - 10 blocks from ground
        
        // Check for vertical conflicts before placing fallback coins
        let hasVerticalConflict = false;
        for (let checkY = Math.max(0, y - 3); checkY <= Math.min(height - 1, y + 3); checkY++) {
          if (checkY !== y && level[checkY] && (level[checkY][x] === 2 || level[checkY][x] === 3)) {
            hasVerticalConflict = true;
            break;
          }
        }
        
        if (level[y] && level[y][x] === 0 && !hasVerticalConflict) {
          level[y][x] = 2;
          coinsPlaced++;
        }
      }
    };

    // Add stepping stones near high platforms to ensure reachability
    this.addSteppingStones = function(level, width, height) {
      const maxJumpHeight = 4; // Mario's maximum jump height from ground level
      const maxRunningJumpHeight = 5; // Mario's maximum running jump height
      const stepStoneHeight = 2; // Height of stepping stone platforms
      
      // Scan for high platforms that might be unreachable
      for (let x = 10; x < width - 10; x++) {
        for (let y = 0; y < height - 6; y++) {
          // Check if this is a platform (solid block with empty space above)
          if (level[y] && level[y][x] !== 0 && level[y][x] !== 2 && level[y][x] !== 6 &&
              level[y - 1] && level[y - 1][x] === 0) {
            
            // Calculate height from ground level
            let distanceFromGround = height - 1 - y;
            
            // If platform is too high for a regular jump (more than 4 blocks)
            if (distanceFromGround > maxJumpHeight) {
              // Try to add stepping stones to the left and right
              const directions = [-1, 1]; // Left and right
              
              for (let dir of directions) {
                const steppingStoneX = x + dir * 4; // 4 blocks away horizontally
                const steppingStoneY = height - 1 - stepStoneHeight; // 2 blocks above ground
                
                // Check if position is valid and empty
                if (steppingStoneX >= 5 && steppingStoneX < width - 5 &&
                    level[steppingStoneY] && level[steppingStoneY][steppingStoneX] === 0 &&
                    level[steppingStoneY][steppingStoneX + 1] === 0) {
                  
                  // Make sure there's ground support below
                  if (level[height - 1][steppingStoneX] !== 0 && 
                      level[height - 1][steppingStoneX + 1] !== 0) {
                    
                    // Add 2-block wide stepping stone platform
                    level[steppingStoneY][steppingStoneX] = 4; // Use brick blocks
                    level[steppingStoneY][steppingStoneX + 1] = 4;
                    
                    break; // Only add one stepping stone per high platform
                  }
                }
              }
            }
          }
        }
      }
      
      // Second pass: Add intermediate stepping stones for very high platforms
      for (let x = 10; x < width - 10; x++) {
        for (let y = 0; y < height - 8; y++) {
          // Check for very high platforms (more than 6 blocks high)
          if (level[y] && level[y][x] !== 0 && level[y][x] !== 2 && level[y][x] !== 6) {
            let distanceFromGround = height - 1 - y;
            
            if (distanceFromGround > 6) {
              // Add intermediate stepping stone at mid-height
              const midX = x + (that.seededRandom() < 0.5 ? -3 : 3);
              const midY = height - 1 - Math.floor(distanceFromGround / 2);
              
              if (midX >= 5 && midX < width - 5 && midY >= 2 && midY < height - 2 &&
                  level[midY] && level[midY][midX] === 0 && level[midY][midX + 1] === 0) {
                
                level[midY][midX] = 4;
                level[midY][midX + 1] = 4;
                break;
              }
            }
          }
        }
      }
    };

    // Global safety check function to prevent Mario from getting stuck while maximizing challenge
    this.applySafetyCheck = function(level, width, height) {
      const maxRegularJump = 3; // Conservative estimate for regular jump capability
      const maxRunningJump = 4; // Conservative estimate for running jump capability  
      const marioHeight = 2; // Mario is about 2 blocks tall
      
      // Scan through level and fix any problematic stacking
      for (let x = 0; x < width - 10; x++) {
        let currentStackHeight = 0;
        
        // Count solid blocks from ground up
        for (let y = height - 2; y >= 0; y--) {
          if (level[y] && level[y][x] !== 0 && level[y][x] !== 2 && level[y][x] !== 6) {
            currentStackHeight++;
            
            // Allow stacks up to running jump height, but no higher
            if (currentStackHeight > maxRunningJump) {
              level[y][x] = 0; // Remove blocks that are too high
            }
          } else {
            currentStackHeight = 0; // Reset count when we hit empty space
          }
        }
        
        // Check for hanging obstacles that might block Mario's path
        for (let y = height - 8; y >= 0; y--) {
          if (level[y] && level[y][x] !== 0 && level[y][x] !== 2 && level[y][x] !== 6) {
            // Check if there's enough clearance below (Mario needs at least 3 blocks of space)
            let clearanceBelow = 0;
            for (let checkY = y + 1; checkY < height && clearanceBelow < marioHeight + 1; checkY++) {
              if (level[checkY] && level[checkY][x] === 0) {
                clearanceBelow++;
              } else {
                break;
              }
            }
            
            // If not enough clearance for Mario to walk under, remove this block
            if (clearanceBelow < marioHeight + 1) {
              level[y][x] = 0;
            }
          }
        }
        
        // Special check for pipe heights - ensure they're never too tall
        for (let y = height - 2; y >= 0; y--) {
          if (level[y] && (level[y][x] === 7 || level[y][x] === 8 || level[y][x] === 9 || level[y][x] === 10)) {
            // Check if this pipe segment is too high from ground
            let distanceFromGround = 0;
            for (let checkY = y; checkY < height - 1; checkY++) {
              distanceFromGround++;
            }
            
            // If pipe segment is higher than regular jump (save running jump for platforms/gaps)
            if (distanceFromGround > maxRegularJump) {
              level[y][x] = 0; // Remove this pipe segment
            }
          }
        }
      }
      
      // Additional check: ensure there's always a passable path from start to finish
      this.ensurePassablePath(level, width, height);
    };

    // Ensure there's always a path Mario can navigate from start to end
    this.ensurePassablePath = function(level, width, height) {
      // Simple pathfinding to ensure basic traversability
      // Check ground level path first
      for (let x = 1; x < width - 15; x++) {
        let canWalk = true;
        let canJump = false;
        
        // Check if Mario can walk or needs to jump
        if (level[height - 2][x] !== 0) {
          canWalk = false;
          
          // Check if he can jump over (max height check)
          let obstacleHeight = 0;
          for (let y = height - 2; y >= 0 && level[y][x] !== 0; y--) {
            obstacleHeight++;
          }
          
          if (obstacleHeight <= 5) { // Within running jump capability
            canJump = true;
          }
        }
        
        // If can't walk or jump, clear the path
        if (!canWalk && !canJump) {
          for (let clearY = height - 6; clearY <= height - 2; clearY++) {
            if (clearY >= 0 && level[clearY][x] !== 0) {
              level[clearY][x] = 0;
            }
          }
        }
      }
    };
    
    // Add strategic ground gaps like v1 static levels
    this.addStrategicGroundGaps = function(level, width, height, count) {
      for (let i = 0; i < count; i++) {
        const gapX = 20 + Math.floor(that.seededRandom() * (width - 60));
        const gapWidth = 3 + Math.floor(that.seededRandom() * 4); // 3-6 block gaps like v1
        
        // Create the gap
        for (let j = 0; j < gapWidth; j++) {
          if (gapX + j < width - 10) {
            level[height - 1][gapX + j] = 0;
          }
        }
        
        // Add pipes near gaps like v1 - creates interesting jump challenges
        if (that.seededRandom() < 0.6) {
          const pipeX = gapX - 5 - Math.floor(that.seededRandom() * 3);
          const pipeHeight = 1; // Always 1 block high to ensure easy navigation
          
          if (pipeX > 5 && pipeX + 1 < width - 10) {
            // Build pipe body
            for (let k = 0; k < pipeHeight; k++) {
              const y = height - 2 - k;
              if (y >= 0) {
                level[y][pipeX] = 7;
                level[y][pipeX + 1] = 8;
              }
            }
            // Add pipe top
            const topY = height - 2 - pipeHeight;
            if (topY >= 0) {
              level[topY][pipeX] = 9;
              level[topY][pipeX + 1] = 10;
            }
          }
        }
        
        // Add platforms over larger gaps to ensure passability
        if (gapWidth > 4) {
          const platformX = gapX + Math.floor(gapWidth / 2);
          const platformY = height - 5;
          if (platformX < width - 10 && platformY >= 0) {
            level[platformY][platformX] = 4;
            level[platformY][platformX + 1] = 4;
          }
        }
      }
    };
    
    // Add pipes to level sections like v1
    this.addSectionPipes = function(level, startX, endX, height, count) {
      for (let i = 0; i < count; i++) {
        const pipeX = startX + Math.floor(that.seededRandom() * (endX - startX - 10));
        const pipeHeight = 1; // Always 1 block high to ensure easy navigation
        
        if (pipeX + 1 < endX && pipeX + 1 < level[0].length - 10) {
          // Build pipe body
          for (let j = 0; j < pipeHeight; j++) {
            const y = height - 2 - j;
            if (y >= 0) {
              level[y][pipeX] = 7;
              level[y][pipeX + 1] = 8;
            }
          }
          
          // Add pipe top
          const topY = height - 2 - pipeHeight;
          if (topY >= 0) {
            level[topY][pipeX] = 9;
            level[topY][pipeX + 1] = 10;
          }
          
          // Coins will be added centrally by addCoinsToLevel function
        }
      }
    };

    this.startGame = function(levelMap, startLevel, isRespawn) {
      view.style(backToMenuBtn, { display: 'block' });

      currentGameLevel = startLevel || 1; // Track the starting level
      marioGame.clearInstances();
      marioGame.init(levelMap, currentGameLevel, isRespawn); //initiate specified level of map (default level 1)

      that.hideMainMenu();
      editor.removeEditorScreen();
      createdLevels.removeCreatedLevelsScreen();
    };

    this.startEditor = function() {
      view.style(backToMenuBtn, { display: 'block' });

      if (editorStarted == 0) {
        //instantiate only once, after that just show and hide the editor screen
        editor.init();
        editorStarted = 1;
      } else {
        editor.showEditorScreen();
      }

      that.hideMainMenu();
      marioGame.removeGameScreen();
      createdLevels.removeCreatedLevelsScreen();
    };

    this.startCreatedLevels = function() {
      view.style(backToMenuBtn, { display: 'block' });

      createdLevels.init();
      that.hideMainMenu();
      marioGame.removeGameScreen();
      editor.removeEditorScreen();
    };

    this.backToMenu = function() {
      marioGame.pauseGame(); //pause game when the back button is pressed so that the gameloop doesnt run more than once
      marioGame.clearTimeOut(); //when mario dies, a timeout starts for resetting the game. Pressing the back button clears that timeout
      marioGame.removeGameScreen(false); // Don't preserve coins when going back to menu

      editor.removeEditorScreen();

      createdLevels.removeCreatedLevelsScreen();
      that.showMainMenu();

      view.style(backToMenuBtn, { display: 'none' });
    };

    this.hideMainMenu = function() {
      view.style(startScreen, { display: 'none' });
    };

    this.restartCurrentGame = function() {
      // Stop current game
      marioGame.pauseGame();
      marioGame.clearTimeOut();
      marioGame.removeGameScreen(false); // Don't preserve coins on full restart
      
      // Restart the game with the same map at level 1 (full restart)
      currentGameLevel = 1;
      
      var map = that.loadMainGameMap();
      that.startGame(map, 1);
      
      // Notify parent that game restarted
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'GAME_RESTART' }, '*');
      }
    };


    this.respawnAtCurrentLevel = function() {
      // Stop current game
      marioGame.pauseGame();
      marioGame.clearTimeOut();
      marioGame.removeGameScreen(false); // Don't preserve coins on respawn - fresh level
      
      // Restart at the same level with fresh map (coins restored)
      var map = that.loadMainGameMap();
      that.startGame(map, currentGameLevel, true); // Pass true for isRespawn
    };

    this.gameOverRestart = function() {
      // Full restart from level 1
      currentGameLevel = 1;
      
      // Stop current game and reset everything (don't preserve coins)
      marioGame.pauseGame();
      marioGame.clearTimeOut();
      marioGame.removeGameScreen(false); // Don't preserve coins on full restart
      
      var map = that.loadMainGameMap();
      that.startGame(map, 1);
    };

    this.updateCurrentLevel = function(level) {
      currentGameLevel = level;
    };
    
    this.navigateToLevel = function(targetLevel) {
      // Stop current game
      marioGame.pauseGame();
      marioGame.clearTimeOut();
      marioGame.removeGameScreen(false); // Don't preserve coins when navigating to specific level
      
      // Set current level and restart with the same map at the specified level
      currentGameLevel = targetLevel;
      
      var map = that.loadMainGameMap();
      that.startGame(map, targetLevel, false); // Start at the specified level
    };
    
    this.showMainMenu = function() {
      view.style(startScreen, { display: 'block' });
      
      // Show level selector for testing
      const levelSelector = document.getElementById('level-selector');
      if (levelSelector) {
        levelSelector.style.display = 'block';
      }
    };
  }

  return {
    getInstance: function() {
      if (instance == null) {
        instance = new MarioMaker();
      }

      return instance;
    }
  };
})();
