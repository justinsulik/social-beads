
/*
Description: jsPsych plugin for a social bead task (jumping to conclusions)
Adapted for presenting social information (e.g. how many beads drawn in a previous generation)
Preferably load p5.min.js and d3.min.js in the main experiment page (otherwise they will be downloaded from cdnjs.cloudflare.com)

Author: Justin Sulik
Contact:
 justin.sulik@gmail.com
 justinsulik.com,
 twitter.com/justinsulik
 github.com/justinsulik

*/

jsPsych.plugins['socialbeads'] = (function() {

  var plugin = {};

  plugin.info = {
    name: 'socialbeads',
    parameters: {
      socialData: {
        type: jsPsych.plugins.parameterType.OBJECT,
        pretty_name: 'Social data',
        default: [],
        description: 'Data from previous generations'
      },
      maxDraws: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Maximum draws',
        default: 15,
        description: 'The maximum number of beads drawn'
      },
      firstColor: {
        type: jsPsych.plugins.parameterType.ARRAY,
        pretty_name: 'Color for beads',
        default: [0, 155, 0],
        description: 'Array of RGB values for one of the bead colors. The complementary color will be generated automatically.'
      },
      colorRatio: {
        type: jsPsych.plugins.parameterType.FLOAT,
        pretty_name: 'Bead ratio',
        default: 0.6,
        description: 'Ratio for coloring beads'
      },
      beadCount: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Number of beads',
        default: 100,
        description: 'Number of beads per urn'
      },
      incentive: {
        type: jsPsych.plugins.parameterType.OBJECT,
        pretty_name: 'Incentivizes for guessing and drawing',
        default: {endowment: 0.15,
                  cost: 0.01,
                  bonus: 1},
        description: 'If base is not null, participants receive a bonus for guessing the right urn. If cost is not null, the base bonus decreases by the cost for every draw'
      },
      rightAnswer: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Right answer',
        default: undefined,
        description: 'What the majority color will turn out to be (regardless which physical urn is the one that remains). Is overridden by the majority color in trial.draws, if given'
      },
      training: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'Training',
        default: false,
        description: 'If true, shows only the instructions so participants can see how a trial would work'
      },
      urnChoice: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Choice of urn',
        default: undefined,
        description: 'Which physical urn to keep visible for drawing from. Is independent of the color of beads drawn (that is determined by trial.draws if given, else trial.rightAnswer)'
      },
      condition: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Condition',
        default: 'dtd',
        description: 'Experimental condition: dtd, decision, both, control'
      },
      generation: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Generation',
        default: null,
        description: 'Current generation'
      },
      chain: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Chain',
        default: null,
        description: 'Current chain'
      },
      branch: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Branch',
        default: null,
        description: 'Current branch'
      },
      forceDraw: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'Force draw',
        default: false,
        description: 'If true, participants have to see at least one bead. If false, they can choose to see 0 beads'
      },
      seeAtStart: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'See at start',
        default: true,
        description: "If false, participants can decide for each and every draw if they want to see its color. If true, they cannot see a bead's color once they've skipped a bead"
      }
    }
  };


  plugin.trial = function(display_element, trial) {

    // check if p5 script is loaded
    if (window.p5) {
        console.log('p5 already loaded...');
    } else {
      $.ajax({
          url: "https://cdnjs.cloudflare.com/ajax/libs/p5.js/0.5.16/p5.min.js",
          dataType: "script",
          success: function() {
            console.log("p5 loaded...");
          }
      });
    }

    // check if d3 script is loaded
    if (window.d3) {
        console.log('d3 already loaded...');
    } else {
      $.ajax({
          url: "https://cdnjs.cloudflare.com/ajax/libs/d3/4.13.0/d3.min.js",
          dataType: "script",
          success: function() {
            console.log("d3 loaded...");
          }
      });
    }

  /*
  Set up basic html
  */

    var css = '<style id="jspsych-beadTask-css"></style>';
    var instructionHtml = '<div id="instructionsContainer"><span id="instructions"></span></div>';
    var buttonHtml = '<div id="buttonContainer"><div id="buttonFlexContainer"><button type="button" id="advanceButton" class="plainButton">Next</button></div></div>';
    var sketchHtml = '<div id="visContainer"></div>';

    var html = '<div id="trialContainer">' + instructionHtml + buttonHtml + sketchHtml + '</div';
    display_element.innerHTML = css + html;

    $('#visContainer').append('<svg id="svgContainer"></svg>');

    var advanceButton = '<div id="buttonFlexContainer"><button type="button" id="advanceButton" class="plainButton">Next</button></div>';
    var payButton = "<div id='buttonFlexContainer'><button type='button' id='showColor' class='plainButton'>Pay to see color</button></div>";
    var skipButton = "<div id='buttonFlexContainer'><button type='button' id='hideColor' class='plainButton'>Draw without seeing color</button></div>";
    var firstRefusal = "<div id='buttonFlexContainer'><button type='button' id='decide' class='plainButton'>I won't pay to see any beads</button></div>";
    var decideButton = "<div id='buttonFlexContainer'><button type='button' id='decide' class='plainButton'>I've seen enough, and won't pay any more</button></div>";

    // add style

    var displayWidth = '800px';

    $('#trialContainer').css({'width': displayWidth,
                              'height': '600px'});

    $('#instructionsContainer').css({'height': '150px'});

    $('#buttonContainer').css({'height': '60px'});

    $('#visContainer').css({'height': '395px'});

    $('#svgContainer').css({'height': '395px',
                            'width': displayWidth,
                            'position': 'fixed',
                            'z-index': '1'});

/*
Trial Functions
*/

    function complementaryColor(RGBcolor) {
      // Find the complementary color of an RGB color in format [red, green, blue]
      var newColors = [];
      RGBcolor.forEach(function(element) {
        newColors.push(255-element);
      });
      return newColors;
    }

    function shuffle(unshuffled) {
      // shuffle an array
      var shuffled = [];
      var N = unshuffled.length;
      for( var i = 0; i < N; i++ ) {
        var index = Math.floor(Math.random() * (unshuffled.length));
        var newValue = unshuffled[index];
        shuffled.push(newValue);
        unshuffled.splice(index, 1);
      }
      return shuffled;
    }

    function ratioArray(arrayLength, colorRatio, direction) {
      //creates an array of 0s/1s in the ratio colorRatio with length arrayLength
      //direction allows for flipping the ratio (60:40 vs 40:60).
      var binaryArray = [];
      for (var i = 0; i < arrayLength; i++) {
        if (i < colorRatio*arrayLength) {
          binaryArray.push(direction);
        } else {
          binaryArray.push(1-direction*1);
        }
      }
      return binaryArray;
    }

    function rgbString(colorTriple) {
      //converts a triple (0,1,2) into a string 'rgb(0,1,2)'
      var colorString = 'rgb('+colorTriple.join()+')';
      return colorString;
    }

/*
Trial variables
*/

    var beadReady;
    var urn1;
    var urn2;
    var bead;
    var drawnBead;
    var record;
    var buttonChoice;
    var remainingUrn;

    var colorsSeen = {};
    var socialSeen = [];
    var urnMargin = 120;
    var urnWidth = 120;
    var urnHeight = 160;
    var urnTop = 200;
    var currentDraw = 0;
    var endY = 30;
    var endX = 30+urnWidth/2;
    var drawDirection = 'out';
    var canContinue = true;
    var beadStartHeight = 100;
    var beadDiameter = 7;
    var showColor = true;
    var firstDraw = true;
    var firstRating = true;
    var dropBeads = false;
    var shuffleUrns = false;
    var startFade = false;
    var undecided = true;

    // variables that depend on setup parameters

    //If not specified, randomize these choices 0 or 1
    trial.urnChoice = trial.urnChoice || Math.floor(Math.random()*2);
    trial.rightAnswer = trial.rightAnswer || Math.floor(Math.random()*2);

    // if generation 0, hide the instructions about social info by setting condition to 'control'
    var previousGens = trial.socialData.length;
    if ( previousGens == 0 ){
      trial.condition = 'control';
    }

    // Add a slot for the current, focal generation
    trial.socialData.push({generation: trial.socialData.length, drawsToDecision: null, choice: null, draws: [], role: 'focal'});

    var colorOrder;
    if (Math.random()>0.5) {
      colorOrder = [0, 1];
    } else {
      colorOrder = [1, 0];
    }
    var trial_data = {
      rts: [],
      branch: trial.branch,
      chain: trial.chain,
      generation: trial.generation,
      condition: trial.condition
    };

    var ratioString = Math.round(trial.colorRatio*100) + ':' + Math.round((1-trial.colorRatio)*100) + ' and ' + Math.round((1-trial.colorRatio)*100) + ':' + Math.round(trial.colorRatio*100);
    var colors = [trial.firstColor, complementaryColor(trial.firstColor)];
    var currentEndowment = trial.incentive.endowment;
    var displayStage = 'blank';
    var socialStages = [];
    switch (trial.condition) {
      case 'dtd':
        socialStages.push('dtd');
      break;

      case 'decision':
        socialStages.push('decision');
      break;

      case 'both':
        socialStages.push('dtd');
        socialStages.push('decision');
      break;

    }
    socialStages.push('focal');
    var displayInstructions = {
        'dtd': 'Any <b>black</b> dots represent <b>how many</b> beads each person paid to see. You can see how many beads they saw out of 15 draws, but not what the colors of those beads were.',
        'decision': 'The colors of the stick figures represent what each participant thought the majority color in this urn is. You can see what they thought, but not whether they guessed right or not.',
        'focal': "The final column represents <b>you</b>. If you choose to see a bead's color, the color will be recorded for you on this column of beads."
    };
    if (previousGens == 0) {
      displayInstructions.focal = "If you choose to see a bead's color, the color will be recorded for you on this column of beads.";
    }

    var draws = ratioArray(trial.maxDraws, trial.colorRatio, trial.rightAnswer);
    trial.draws = shuffle(draws);


    // save draws to trial data
    trial_data.draws = trial.draws;

    var cssString = '.color_1 {background-color: '+ rgbString(colors[colorOrder[0]])+'}';
    cssString += '.color_2 {background-color: '+ rgbString(colors[colorOrder[1]])+'}';
    cssString += '.right_answer {background-color: '+ rgbString(colors[trial.rightAnswer])+'}';
    cssString += '#buttonContainer {text-align: center}';
    cssString += '#buttonFlexContainer {text-align: center; display: inline-block; width: 45%}';
    cssString += '#buttonWideContainer {text-align: center; display: inline-block; width: 100%}';
    cssString += 'button {display: inline-block; outline: none; text-align: center; border: 0.1em solid black; padding:0.1em 1.2em; font-size: 0.8em; font-weight:300; transition: background-color 0.2s;}';
    cssString += 'button[active="inactive"] {border: #EAEAEA; color: #EAEAEA}';
    cssString += '.chooseButton {padding: 0.8em 1.2em; position: relative;}';
    cssString += '.plainButton:hover:not([active="inactive"]) {background-color: #DBE8E9}';
    $('#jspsych-beadTask-css').html(cssString);

/*
Trial data objects
*/

    var trialGraph = {

      /*
      Object that holds information about trial states and transitions
      Properties are strings representing what stage of the trial we're currently on
      Those stages in turn have properties describing:
        - instructions: what prompt to display on screen
        - button: what button to display
        - successor: what stage comes next
        - onClick: what to do when the trial is advanced
        - setup: what to do before this stage starts
      Transitioning around the graph and calling of functions is handled by trialControl
      */

      'instructions': {
        successor: function() {

            if ( instructions.index < instructions.tags.length-1 ) {
              return 'instructions';
            } else {
              if (trial.training){
                  return 'drawBead';
              } else {
                  return 'socialInfo';
              }
            }
        },
        instructions: '',
        button: advanceButton,
        onClick: function(e) {

          $('#instructions').css('display', 'none');
          $('.plainButton').attr('active','inactive');

          instructionTag = instructions.tags[instructions.index];

          trial_data.rts.push({instructionTag: Date.now()-start_time});

          switch( instructionTag ) {

            case 'color':

              trialControl.advance();

            break;

            case 'randomize':

              trialControl.advance();

            break;

            case 'drop':

              dropBeads = true;
              $('#instructions').css("display", "none");

            break;

            case 'shuffle':

              shuffleUrns = true;
              $('#instructions').css("display", "none");

            break;

            case 'pick':

                if ( trial.urnChoice < 1 ) {
                  urn2.startFade = true;
                  urn1.moveToSide = true;
                  remainingUrn = urn1;
                } else {
                  urn1.startFade = true;
                  urn2.moveToSide = true;
                  remainingUrn = urn2;
                }

            break;

          }
        },
        setup: function() {

          this.instructions = instructions.step();
          $('#instructions').fadeIn(100);

        }
      },

      'socialInfo': {
        successor: function() {
          if (trial.forceDraw){
            return 'drawBead';
          } else {
            return 'chooseAction';
          }
        },
        button: advanceButton,
        instructions: function() {
          var instructionString;
          if (previousGens > 0){
              if (previousGens > 1){
                instructionString = 'There are ' + previousGens + ' people who have already seen beads from this urn and made their decisions. ';
                instructionString += "Each had the opportunity to see up to "+ trial.maxDraws +" <b>random</b> draws from the <b>same</b> urn that your beads will be drawn from. The draws were random, so people were likely to see different sequences. Like you, each participant could decide whether they wanted to pay to see each bead's color. ";
              } else {
                instructionString = 'There is 1 person who has already seen beads from this urn and made their decision. ';
                instructionString += "They had the opportunity to see up to "+ trial.maxDraws +" <b>random</b> draws from the <b>same</b> urn that your beads will be drawn from. The draws were random, so they were likely to see a different sequence. Like you, they could decide whether they wanted to pay to see each bead's color. ";
              }
              if (trial.condition == 'control'){
                instructionString += "We are <b>not</b> giving you information about how many beads they saw or what their guesses were.";
              }
          } else { instructionString = trial.maxDraws + " beads will be randomly drawn from the urn and replaced. You can choose to how many beads' colors you want to see.";
          }

          return instructionString;
        },
        onClick: function(e) {

          if ( socialStages.length == 0 ) {
            trialControl.advance();
          }

          displayStage = socialStages.shift();
          socialSeen.push(displayStage);
          $('#instructions').html(displayInstructions[displayStage]);
          updateDTD(trial.socialData);
          updateDecisions(trial.socialData);
          // console.log(displayStage);

        },
        setup: function() {
          // updateDTD(displayStage);
          $('#instructions').fadeIn(100);
        }
      },

      'drawBead': {
        successor: function() {
          return  'returnBead';
        },
        button: advanceButton,
        instructions: function() {
                if ( trial.training ) {
                  return "Beads will only be drawn from this <b>one urn</b>. The aim is to draw beads from this urn until <b>you're ready to guess</b> the <b>majority color</b> (what color most of the beads in this urn are).";
                } else {
                  if (currentDraw == 0 && trial.forceDraw){
                    return 'Click to draw a bead from the urn. You have to draw at least one bead. Your endowment is $' + trial.incentive.endowment + ' and this first bead will cost $' + trial.incentive.cost + '.';
                  } else {
                    return '';
                  }
                }
        },
        onClick: function(e) {

          $('.plainButton').attr('active','inactive');
          trial_data.rts.push({'drawBead': Date.now()-start_time});
          beadReady = true;//?
          bead = new drawnBead(currentDraw, showColor);
          $('#instructions').css('display', 'none');
          if (currentDraw == 0) {
            colorsSeen[currentDraw] = true;
          }
          firstDraw = false;
          // currentEndowment = (currentEndowment - trial.incentive.cost).toFixed(2);

        },
        setup: function() {

          drawDirection = 'out';
          $('#instructions').fadeIn(100);
          if ( !firstDraw ){
            $('.plainButton').attr('active','inactive');
          }

        }
      },

      'returnBead': {
        successor: function() {
          if ( trial.training ) {
            return 'finalInstructions';
          } else {
            if ( currentDraw >= trial.maxDraws ) {
              return 'decide';
            } else {
              return 'chooseAction';
            }
          }
        },
        button: advanceButton,
        instructions: function() {
          if ( trial.training ) {
            return 'Whenever a bead is drawn, we will <b>put it back</b> in the urn. '+
            'This means that the <b>number of beads</b> and the <b>ratio of bead colors</b> in the urn will <b>stay the same</b> throughout the whole task. '+
            'It also means that the same bead <b>could</b> be drawn more than once. ';
          } else {
            if (showColor){
              return 'Click to <b>return</b> the bead to the urn and <b>record</b> what color bead you saw.';
            } else {
              return 'Click to <b>return</b> the bead to the urn.';
            }
          }

        },
        onClick: function(e) {

          $('.plainButton').attr('active','inactive');
          trial_data.rts.push({'returnBead': Date.now()-start_time});
          $('#instructions').css('display','none');


          var lastGeneration = trial.socialData.length;
          var nextBeadColor = rgbString(colors[trial.draws[currentDraw]]);
          updateDTD(trial.socialData);
          if(!trial.training){
            if (drawDirection=='out'){
              updateProgress(currentDraw);
              if(showColor){
                flashBead(lastGeneration, currentDraw);
              }
              currentDraw += 1;
            }
          }

          drawDirection = 'in';



        },
        setup: function() {
            $('#instructions').fadeIn(100);
        }
      },

      'chooseAction': {
        successor: function(e) {
          return 'drawBead';
        },
        button: function(){
          if (trial.seeAtStart) {
            if (undecided) {
              if (currentDraw==0){
                return payButton + firstRefusal;
              } else {
                return payButton + decideButton;
              }

            } else {
              return skipButton;
            }
          } else {
            return payButton + skipButton;
          }
        },
        instructions: function() {

          var leadIn;
          var ifYes;
          var ifNo;
          var beadAdjective;
          var remainder = trial.maxDraws-currentDraw;
          var bonusReminder = 'The bonus for guessing the right urn is $' + trial.incentive.bonus + '. ';
          var beadInflected = remainder==1 ? 'bead' : 'beads';
          if (currentDraw==0){
            leadIn = "We will draw a total of " + trial.maxDraws + " beads. ";
            beadAdjective = 'first';
          } else {
            leadIn = "We will draw " + remainder + " more "+beadInflected+". ";
            beadAdjective = 'next';
          }

          if (trial.seeAtStart) {
            if (undecided) {
              ifYes = "Would you like to see the "+beadAdjective+" bead's color? If 'yes', you will pay $" + trial.incentive.cost + " out of your endowment, which is currently $" + currentEndowment + ". ";
              ifNo = "If 'no', the remaining beads will be grayed out so you can't see their color. However, we will continue to draw up until 15 beads, so the task will not end earlier if you choose to stop seeing the color of the beads.";
            } else {
              ifYes = "";
              ifNo = "You've decided not to pay to see any more, so the remainder of the beads will be grayed out.";
            }
          } else {
            ifYes = "Would you like to see the "+beadAdjective+" bead's color? If so, you will pay $" + trial.incentive.cost + " out of your endowment, which is currently $" + currentEndowment + ". ";
            ifNo = "If not, it will be grayed out so you can't see its color.";
          }
          return leadIn + ifYes + ifNo + bonusReminder;
        },
        onClick: function(e) {

          $('.plainButton').attr('active','inactive');
          trial_data.rts.push({'chooseAction': Date.now()-start_time});
          buttonChoice = e.target.id;
          if ( buttonChoice == 'showColor' & trial.incentive.cost > 0 ) {
            colorsSeen[currentDraw] = true;
            currentEndowment = (currentEndowment - trial.incentive.cost).toFixed(2);
            showColor = true;
          }
          if (buttonChoice == 'hideColor'){
            showColor = false;
            colorsSeen[currentDraw] = false;
          }
          if (buttonChoice == 'decide'){
            undecided = false;
            showColor = false;
            colorsSeen[currentDraw] = false;
          }
          drawDirection = 'out';
          beadReady = true;
          bead = new drawnBead(currentDraw, showColor);
          trialControl.advance();
        },
        setup: function() {
          $('#instructions').fadeIn(100);
        }
      },

      'decide': {
        successor: function() {
          return 'feedback';
        },
        button: function() {
          return '<div id="buttonWideContainer"><button type="button" id="chooseLeft" class="color_1 chooseButton"></button></div> <div id="buttonWideContainer"><button type="button" id="chooseRight" class="color_2 chooseButton"></button></div>';
        },
        instructions: 'What do you think the majority color in this <b>urn</b> is?',
        onClick: function(e) {
          var choice;
          buttonChoice = e.target.id;
          if ( buttonChoice == 'chooseLeft' ) {
            choice = colorOrder[0];
          } else if ( buttonChoice == 'chooseRight') {
            choice = colorOrder[1];
          } else {
            choice = 'NA';
            console.log('Button choice not recorded');
          }
          var end_time = Date.now() - start_time;
          var drawChoices =
          trial_data.rts.push({'end': end_time});
          trial_data.choice = choice;
          trial_data.colorsSeen = _.map(colorsSeen, function(d, i){
            if (d){
              return 1;
            } else {
              return 0;
            }
          });
          trial_data.drawsToDecision = _.reduce(colorsSeen, function(sum, draw){
            if (draw == true) {
              sum+=1;
            }
            return sum;
          }, 0);
          trial_data.endowment = currentEndowment;
          trial_data.maxDraws = trial.drawCount;
          trial_data.colorRatio = trial.colorRatio;
          trial_data.beadCount = trial.beadCount;
          trial_data.incentive = trial.incentive;
          trial_data.urnChoice = trial.urnChoice;
          trial_data.rightAnswer = trial.rightAnswer;
          trial_data.correct = trial.rightAnswer==trial_data.choice;

          console.log(trial_data);

          trialControl.advance();

        },
        setup: function() {

          $('#instructions').show();

        }
      },
      'feedback': {
        successor: function() {
          return 'end';
        },
        button: '<div id="buttonFlexContainer"><button type="button" id="advanceButton">Finish</button></div>',
        instructions: function() {
          var feedbackString = 'The majority color in this urn was <span class="right_answer">this</span>, so you were ';
          var correctString = function() {
                                if (trial_data.correct) {
                                  return 'correct. ';
                                } else {
                                  return 'incorrect. ';
                                }
                              };
          var bonusString = function() {
            var endowmentString = 'Your remaining endowment is $'+currentEndowment + '. ';
            var bonusString;
            var total;

            if (trial_data.correct) {
              bonusString = 'Your bonus for guessing right is $'+trial.incentive.bonus+'. ';
              total =  (parseFloat(currentEndowment)+trial.incentive.bonus).toFixed(2);
            } else {
              bonusString = "";
              total = currentEndowment;
            }
            return endowmentString + bonusString + 'On top of the basic payment for this HIT, you will receive an extra $' + total + '.';

          };
          return feedbackString+correctString()+bonusString();
        },
        onClick: function(e) {
          jsPsych.finishTrial(trial_data);

          display_element.innerHTML = '';
          mainSketch.remove();
        },
        setup: function() {

          $('#instructions').show();

        }

      },
      'finalInstructions': {
        successor: function() {
          return 'end';
        },
        button: advanceButton,
        instructions: "In this example, we drew just one bead, but in the actual trial, we will draw " + trial.maxDraws + ", and you will decide how many of those " + trial.maxDraws + " you want to see. The actual trial will have different color beads and a different ratio from what you just saw in this example.",
        onClick: function(e) {
          trial_data = {};
          var end_time = Date.now();
          trial_data.rt = end_time - start_time;
          jsPsych.finishTrial(trial_data);
          display_element.innerHTML = '';
          mainSketch.remove();

        },
        setup: function() {

          $('#instructions').show();

        }
      }

    };


    // trial controller: an object tracking transisions along the trial path


    var trialControl = {
      /*
      Object for handling transitions around trialGraph, and calling appropriate functions for setup and whatever stage we're on
      */

      stage: null,
      data: null,

      initialize: function(x) {
        this.stage = x;
        this.populate();
        this.data.setup();
        this.updateInstructions();
      },
      populate: function() {
        this.data = trialGraph[this.stage];
      },
      advance: function() {
        var nextStage = this.data.successor();
        instructions.index+=1;
        this.stage = nextStage;
        this.populate();
        this.updateButtons();
        this.data.setup();
        this.updateInstructions();
      },
      updateButtons: function() {
        $('#buttonContainer').html(this.data.button);
      },
      updateInstructions: function() {
        $('#instructions').html(this.data.instructions);
      },

    };

    var instructionsTraining = ["In this task, we will color beads with two different colors (e.g., some beads will be black and some will be white). We'll drop beads of both colors into <b>two separate urns</b>.",
                     'One urn will be <b>majority</b> black and the other will be <b>majority</b> white, though each urn will have <b>some</b> beads of each color.',
                     'The beads are shuffled and then dropped in the urns.',
                     'Next, we will shuffle the urns <b>thoroughly</b> so you will initially have <b>no idea</b> which of these urns contains mostly black beads and which contains mostly white.',
                     "Then we will pick one of these urns. You initially have no idea which it is. Then we will start drawing beads <b>at random</b> from whichever urn gets picked."];

    var instructionsTrial = ['First, we color the beads in the ratios ' + ratioString,
                     'Next, we shuffle the beads',
                     'We drop the beads in the urns',
                     'We shuffle the urns',
                     "Finally, we show you which urn you will be drawing beads from, and whose majority color you must identify."];

    // instructions data

    var instructions = {
      /*
      This object contains data about the instructions displayed during setup
      */
      instructionSet: [],
      tags: ['color', 'randomize', 'drop', 'shuffle', 'pick'],
      index: 0,
      step: function() {
        return this.instructionSet[this.index];
      },

    };

    if ( trial.training ) {
      instructions.instructionSet = instructionsTraining;
    } else {
      instructions.instructionSet = instructionsTrial;
    }

    trialControl.initialize('instructions');

/*
p5 pseudoclasses
*/

  function Urn(sketch, x, y, side, image) {

    this.sketch = sketch;
    this.position = sketch.createVector(x,y);
    this.side = side;
    this.direction = 1-2*this.side; //if on left, move to right, if on right, move to left
    this.velocity = sketch.createVector(this.direction*10,0);
    this.acceleration = sketch.createVector(this.direction,0); //?
    this.moves = 0;
    this.visible = 1;
    this.alpha = 255;
    this.picked = false;
    this.startFade = false;
    this.moveToSide = false;
    this.distanceToSide = 0;

    if ( image != null ) {
      this.image = image;
    }

    this.display = function() {

      switch( instructions.tags[instructions.index] ) {

        case 'shuffle': //switch urns

          if ( shuffleUrns == true ) {
            if ( sketch.abs(this.velocity.x) < 100 ) {
              this.velocity.add(this.acceleration);
            }
            if ( this.moves < 10 ) {

              if ( this.position.x > sketch.width-2*urnMargin | this.position.x < urnMargin) {
                this.velocity.mult(-1);
                this.acceleration.mult(-1);
                this.direction *= -1;
                this.moves += 1;
              }

              this.position.add(this.velocity);

            } else {

              if ( (this.direction == 1 & this.position.x + this.velocity.x < sketch.width-2*urnMargin) | (this.direction == -1 & this.position.x + this.velocity.x > urnMargin) ) {
                this.position.add(this.velocity);
              } else {
                trialControl.advance();
              }
          }
        }

        break;

        case 'pick':

          if ( this.startFade == true ) {
            if ( this.alpha > 0 ) {
              this.alpha-=8;
            } else {
              this.visible = 0;
              trialControl.advance();
            }
          }

      }

      if (trialControl.stage == 'socialInfo' || (trial.training && trialControl.stage == 'drawBead')) {
        if (this.distanceToSide == 0){
          this.distanceToSide = this.position.x - 30;
        }
        if (this.moveToSide == true){
          if (this.position.x >= 30) {
            this.position.x -= this.distanceToSide/20;
          } else {

              updateDTD(trial.socialData);
              updateDecisions(trial.socialData);
              this.moveToSide = false;

          }
        }

      }

      if ( this.visible == 1 ) {
        if ( this.image.width <= 1 ) {
          sketch.fill(150, this.alpha);
          sketch.stroke(0, this.alpha);
          sketch.rect(this.position.x, this.position.y, urnWidth, urnHeight, 0, 0, 20, 20);
        } else {
          sketch.stroke(255);
          // if ( instructions.index!=3 ) {
          //   sketch.fill(255);
          //   sketch.rect(this.position.x, this.position.y, urnWidth, urnHeight);
          // }
          sketch.image(urnImg, this.position.x+1, this.position.y, urnWidth, urnHeight);
          sketch.fill(255, 255-this.alpha);
          sketch.strokeWeight(0);
          sketch.rect(this.position.x, this.position.y, urnWidth+2, urnHeight);
          sketch.strokeWeight(1);
        }

      }
    };

  }

  function Beadset(sketch, urn) {

    this.sketch = sketch;
    this.urn = urn;
    this.anchor = sketch.createVector(this.urn.position.x + (urnWidth/2-(sketch.sqrt(trial.beadCount)-1)/2*beadDiameter), this.urn.position.y - beadStartHeight);
    this.direction = this.urn.side;

    this.beads = [];
    var beadColors = ratioArray(trial.beadCount, trial.colorRatio, this.direction);
    beadColorsShuffled =  sketch.shuffle(beadColors);

    for (var i = 0; i < trial.beadCount; i++) {
      this.beads[i] = new Bead(sketch, i, this.anchor, beadColors[i], beadColorsShuffled[i]);
    }

    this.display = function() {

      for (var i = 0; i < trial.beadCount; i++) { //
        if ( dropBeads ) {
          this.beads[i].drop();
        }
        this.beads[i].display();
      }
    };

  }

  function Bead(sketch, id, anchorPosition, color, shuffledColor) {

    this.sketch = sketch;
    this.anchorPosition = anchorPosition;
    this.color = colors[color];
    this.shuffledColor = colors[shuffledColor];
    this.id = id;
    this.xOffset = (this.id % sketch.sqrt(trial.beadCount)) * beadDiameter;
    this.yOffset = sketch.floor(this.id / sketch.sqrt(trial.beadCount) ) * beadDiameter;
    this.position = sketch.createVector(this.anchorPosition.x + this.xOffset, this.anchorPosition.y + this.yOffset);
    this.acceleration = sketch.createVector(0, 1);
    this.velocity = sketch.createVector(0, sketch.random(this.yOffset/3, this.yOffset/3+1));
    this.invisible = false;
    this.dropped = 0;

    this.display = function() {

      if ( trialControl.stage == 'instructions' ) {

          switch( instructions.tags[instructions.index] ) {

            case 'color':

              sketch.fill(140);
              sketch.stroke(140);

            break;

            case 'randomize':

              sketch.fill(this.color);
              if (trial.training) {
                sketch.stroke(100);
              } else {
                sketch.stroke(this.color);
              }

            break;

            case 'drop':

              sketch.fill(this.shuffledColor);
              if (trial.training) {
                sketch.stroke(100);
              } else {
                sketch.stroke(this.shuffledColor);
              }

            break;

            case 'shuffle':

              sketch.fill(this.shuffledColor);
              sketch.stroke(this.shuffledColor);

            break;

            case 'pick':

              sketch.fill(this.color);
              sketch.stroke(this.color);

            break;

          }
        } else {

          sketch.fill(this.color);
          sketch.stroke(this.color);

        }

      if ( this.invisible == false ) {
        sketch.ellipse(this.position.x,this.position.y, beadDiameter-1, beadDiameter-1);
      }
    };

    this.drop = function() {
      if ( this.position.y > urnTop-15 ) {
        this.dropped = 1;
        this.invisible = true;
      }
      this.velocity.add(this.acceleration);
      this.position.add(this.velocity);
    };

  }



/*
p5 sketch
Setup sketches in "instance mode" (vs. default "global mode").
This is needed for (a) integrating p5 with the jsPsych-generated html page and (b) allowing multiple sketches per page (if trial includes graded estimation)
See here for overview of instance mode: https://github.com/processing/sketch.js/wiki/sketch.js-overview#instantiation--namespace
The following actually uses a short-cut version of instance mode, as described here: https://forum.processing.org/two/discussion/17332/using-instance-mode-to-create-multiple-sketches-on-the-same-page
*/

  var mainSketch = new p5(function( sketch ) {

    // declare sketch variables

    var beadset1;
    var beadset2;
    var beads = [];
    var beadColors;
    var beadColorsShuffled;
    var distanceX;
    var distanceY;
    var percentTravelled = 0;
    var drawSpeed = 0.05;


    var sketchHeight = $('#visContainer').css('height').match(/\d+/)[0];
    var sketchWidth = $('#visContainer').css('width').match(/\d+/)[0];

    // sketch functions & pseudo-classes

    drawnBead = function(draw, showColor){

      var position = sketch.createVector(remainingUrn.position.x+urnWidth/2, remainingUrn.position.y);
      this.id = draw;
      this.position = position.copy();
      this.startPosition = position.copy();

      if (showColor){
        this.color = colors[trial.draws[this.id]];
      } else {
        this.color = '#EAEAEA';
      }

      this.update = function () {
        if( drawDirection == 'out' ) {
          if( percentTravelled < 1 ){
            percentTravelled += drawSpeed;
            this.position.x = sketch.bezierPoint(this.startPosition.x, this.startPosition.x, endX, endX, percentTravelled);
            this.position.y = sketch.bezierPoint(this.startPosition.y, endY+(this.startPosition.y-endY)/2, endY+(this.startPosition.y-endY)/2, endY, percentTravelled);
          } else if( trialControl.stage == 'drawBead') { //without the IF, there seems to be time enought to call trialControl.advance() twice (given that sketch.draw is on a loop)
            trialControl.advance();
          }
        } else if (drawDirection == 'in') {
          if( percentTravelled > 0 ){
            percentTravelled -= drawSpeed;
            this.position.x = sketch.bezierPoint(this.startPosition.x, this.startPosition.x, endX, endX, percentTravelled);
            this.position.y = sketch.bezierPoint(this.startPosition.y+beadDiameter+2, endY, this.startPosition.y, endY, percentTravelled);
          } else if( trialControl.stage == 'returnBead' ){

            trialControl.advance();
            // console.log(trialControl.stage, draw);
                beadReady = false;
          }
        }
      };

      this.display = function() {
        sketch.fill(this.color);
        if(trial.training){
          sketch.stroke(100);
        } else {
          sketch.stroke(this.color);
        }
        sketch.ellipse(this.position.x, this.position.y, beadDiameter+1, beadDiameter+1);
      };

    };

    // sketch functions

    function checkBeadsDropped(){
      /*
      Prevent clicking to the next stage if not all the beads have dropped yet
      */
      var droppedCount = 0;
      beadset1.beads.forEach(function(e){
        droppedCount += e.dropped;
      });
      beadset2.beads.forEach(function(e){
        droppedCount += e.dropped;
      });

      if( droppedCount >= trial.beadCount*2 ){
        trialControl.advance();
      }

    }

    function drawBead(drawCount){
      /*
      Animate a bead moving in and out of the urn
      */
      bead.update();
      bead.display();
    }


    // set up sketch

    sketch.setup = function() {

      urnImg = sketch.loadImage('./img/greek-urn-md.png'); //image used under CC0 creative commons licence, http://www.clker.com/clipart-greek-urn-1.html
      var sketchCanvas = sketch.createCanvas(sketchWidth, 400);
      sketch.background(255);

      sketch.parentId = $(sketch.canvas).parent().attr('id');

      urn1 = new Urn(sketch, urnMargin, urnTop, 0, urnImg);
      urn2 = new Urn(sketch, sketch.width-2*urnMargin, urnTop, 1, urnImg);
      beadset1 = new Beadset(sketch, urn1);
      beadset2 = new Beadset(sketch, urn2);
      if(trial.record){
        record = new Record();
      }

    };

    // draw sketch

    sketch.draw = function() {


      sketch.background(255);

      switch( trialControl.stage ){

        case 'instructions':

          beadset1.display();
          beadset2.display();

          if( instructions.tags[instructions.index] == 'drop'){
            checkBeadsDropped();
          }

        break;

        case 'drawBead':

          if( beadReady ){
            drawBead(currentDraw);
          }

        break;

        case 'returnBead':

          drawBead(currentDraw);

        break;

      }


      urn1.display();
      urn2.display();

      if(trial.record){
        if(record.records.length>0){
          record.display();
        }
      }


    };
  }, 'visContainer');


/*
d3 graph
*/

    //get grid intersection points from data and maxDraws
    function gridData() {
      var tempData = [];
      for( var row = 0; row < trial.maxDraws; row++){
        for (var column = 0; column < Object.keys(trial.socialData).length; column++) {
          tempData.push([column,row]);
        }
      }
      return tempData;
    }

    //sizing
    var margin = {top: 15, right: 100, bottom: urnTop, left: 200},
          chart = {width: 800, height: 395},
          dotWidth = trial.socialData.length*(chart.width - margin.left - margin.right)/20,
          dotHeight = chart.height - margin.top - margin.bottom,
          choiceAnchor = chart.height - margin.bottom,
          beadWidth = (dotHeight)/(trial.maxDraws*2)-1;

    //set up svg
    var svg = d3.select("#svgContainer");

    // two main groups within svg:

    //////////////////////////////////////////////////////////
    // 1: dotgrid for displaying previous generations' DTDs //
    //////////////////////////////////////////////////////////
    var dotGrid = svg.append("g")
        .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

    //x scale
    var x = d3.scaleLinear()
        .domain([0, Object.keys(trial.socialData).length])
        .rangeRound([0, dotWidth]);

    //y scale
    var y = d3.scaleLinear()
        .domain([0, trial.maxDraws])
        .rangeRound([dotHeight, 0]);

    //build grid
    function updateDTD(socialData){
      dotGrid.selectAll("circle").remove();
      dotGrid.selectAll("circle")
        .data(gridData())
        .enter().append("circle")
          .attr("cx", function(d) {return d[0] + 1 == socialData.length? x(d[0]+1) : x(d[0]); })
          .attr("cy", function(d) {return y(d[1]); })
          .attr("r", beadWidth)
          .attr("id", function(d) {return "circle-"+d[0]+"-"+d[1]; })
          .attr("fill", function(d) { return dotColor(d, socialData); });
    }

    function dotColor(d, socialData){

      var generation = d[0];
      if (socialData[generation].role == 'focal'){
        if (displayStage == 'focal' || socialStages.length == 0) {
          if(trialControl.stage=='returnBead'){
            var nextColor = rgbString(colors[trial.draws[d[1]]]);
            // console.log(d[1]<=currentDraw, colorsSeen[currentDraw]);
            return (d[1] <= currentDraw)  && colorsSeen[d[1]] ? nextColor : '#EAEAEA';
          } else {
            return '#EAEAEA';
          }

        } else {
          return 'transparent';
        }
      } else {
        if ( displayStage == 'dtd' || socialSeen.includes('dtd') ) {
          return d[1] < socialData[d[0]].drawsToDecision ? '#000000' : '#EAEAEA';
        } else {
          return '#EAEAEA';
        }

      }

    }

    // horizontal line tracking progress

    var adjustment;
    if (trial.socialData.length<=1){
      adjustment = 0;
    } else {
      adjustment = 3;
    }

    dotGrid.append("path") // nothing gets drawn since there's no path d attribute yet
      .attr('id', 'progressTrack')
      .attr('stroke', 'blue')
      .attr('stroke-width', 2)
      .attr('opacity', 0.6);


    function updateProgress(draw){
      var bar = d3.select('#progressTrack');
      var lineY = y(draw) - beadWidth - 1;
      var lineX;
      if (trial.seeAtStart) {
        lineX = x(trial.socialData.length)+beadWidth+adjustment;
      } else {
        lineX = x(trial.socialData.length-2)+beadWidth+adjustment;
      }
      bar.attr('d', 'M -10 ' + lineY + ' H' + lineX);
    }

    // records the latest drawn bead color with a flashing animation

    function flashBead(generation, draw){

      var nextColor = rgbString(colors[trial.draws[draw]]);

      dotGrid.append('circle')
        .attr('cx', x(generation))
        .attr('cy', y(draw))
        .attr('r', 10)
        .attr('fill', nextColor)
        .transition()
        .delay(100)
        .attr('fill', 'transparent')
        .attr('r', 60);

    }

    /////////////////////////////////////////////////////////////////////
    // 2: previousGen for displaying previous generations' urn choices //
    /////////////////////////////////////////////////////////////////////

    //add x axis
    var decisionsBar = svg.append("g")
      .attr("transform",
                "translate(" + margin.left + "," + choiceAnchor +")");

    // add stick figures
    function stickFigure(d){
      var offset = d.generation + 1 == trial.socialData.length ? d.generation + 1 : d.generation;
      var xStart = x(offset),
          torsoTop = 34,
          torsoBottom = torsoTop+15,
          headSize = 7,
          armsDelta = {x: 8.5, y: 4},
          armHeight = 6.5,
          legsDelta = {x: 8.5, y: 13};

      var start = ["M", xStart, torsoTop].join(" ");
      var head = ["M", xStart+1, torsoTop, "A", headSize, headSize, 0, 1, 0, xStart-1, torsoTop].join(" ");
      var torso = ["M", xStart, torsoTop, "V", torsoBottom].join(" ");
      var leftLeg = ["L", xStart-legsDelta.x, torsoBottom+legsDelta.y, "M", xStart, torsoBottom].join(" ");
      var rightLeg = ["L", xStart+legsDelta.x, torsoBottom+legsDelta.y, "M", xStart, torsoBottom].join(" ");
      var leftArm = ["M", xStart, torsoTop+armHeight, "L", xStart-armsDelta.x, torsoTop+armHeight+armsDelta.y].join(" ");
      var rightArm = ["M", xStart, torsoTop+armHeight, "L", xStart+armsDelta.x, torsoTop+armHeight+armsDelta.y].join(" ");

      return start+head+torso+leftLeg+rightLeg+leftArm+rightArm;
    }

    function stickFigureColor(d){
      if (d.choice == null) {
        if (displayStage == 'focal' || socialSeen.includes('focal') ){
          return 'black';
        } else {
          return 'transparent';
        }
      } else {
        if ( displayStage == 'decision' || socialSeen.includes('decision')  ) {
          return rgbString(colors[d.choice]);
        } else {
          return 'black';
        }
      }
    }

    function updateDecisions(socialData){
      decisionsBar.selectAll("path").remove();
      decisionsBar.selectAll("path")
        .data(socialData)
        .enter().append("path")
          .attr("d", function(d){ return stickFigure(d);})
          .attr("fill", "transparent")
          .attr("stroke", function(d){ return stickFigureColor(d);})
          .attr("stroke-width", function(d){ return d.generation + 1 == socialData.length ? "6" : "3.5";})
          .attr("stroke-linecap", "round");
    }

/*
Input handlers
*/

    $("#buttonContainer").on("click", "button", function(e){
      // console.log(trialControl.stage);
      trialControl.data.onClick(e);

    });

    $("#buttonContainer").on("mousedown", "button", function(){
        //update record
    });

var start_time = Date.now();

};

return plugin;

})();
