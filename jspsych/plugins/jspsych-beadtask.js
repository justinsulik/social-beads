/*
Description: jsPsych plugin for a bead task (jumping to conclusions)
Adapted for presenting social information (e.g. how many beads drawn in a previous generation)
Preferably load p5.min.js and d3.min.js in the main experiment page (otherwise it will be downloaded from cdnjs.cloudflare.com)

Author: Justin Sulik
Contact:
 justin.sulik@gmail.com
 justinsulik.com,
 twitter.com/justinsulik
 github.com/justinsulik

*/

jsPsych.plugins['beadtask'] = (function(){

  var plugin = {};

  plugin.info = {
    name: 'beadtask',
    parameters: {
      training: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'Training trial',
        default: false,
        description: 'If true, shows only the instructions so participants can see how a trial would work'
      },
      firstColor: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Color for beads',
        default: [0, 155, 0],
        description: 'Array of RGB values for one of the bead colors. The complementary color will be generated automatically.'
      },
      drawCount: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Draw count',
        default: 100,
        description: 'The maximum number of bead draws allowed before choosing an urn.'
      },
      draws: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Beads to draw',
        default: [],
        description: 'Array of binary values to specify which color bead is drawn in what order.'
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
      record: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'Display record',
        default: true,
        description: 'If true, a record of previously drawn beads is displayed. If false, no record is displayed.'
      },
      graded: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'Graded estimation',
        default: true,
        description: 'If true, participants provide an estimation of confident they are which urn it is, turn by turn. If false, they pick an urn at the end'
      },
      urnChoice: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Choice of urn',
        default: undefined,
        description: 'Which physical urn to keep visible for drawing from. Is independent of the color of beads drawn (that is determined by trial.draws if given, else trial.rightAnswer)'
      },
      rightAnswer: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Right answer',
        default: undefined,
        description: 'What the majority color will turn out to be (regardless which physical urn is the one that remains). Is overridden by the majority color in trial.draws, if given'
      },
      sequential: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'Serial choices',
        default: true,
        description: 'If true, participants decide after each draw whether they want to draw another bead. Otherwise, they either see a set number of beads, or pick a number of beads up front, depending on trial.allowChoice'
      },
      allowChoice: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'Allow choice',
        default: true,
        description: 'If true and if trial.sequential, participant chooses up front how many beads to see. Otherwise they are shown the maximum of trial.draws.length or trial.drawCount'
      },
      feedback: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'Feedback provided',
        default: true,
        description: 'If true, participants are told what the right color was, if they were correct (and if the trial includes an incentive, what their bonus was).'
      },
      pickUrn: {
        type: jsPsych.plugins.parameterType.BOOLEAN,
        pretty_name: 'Pick an urn',
        default: false,
        description: 'If true, participants click on an urn to choose it. If false, a random urn is picked.'
      },
      incentive: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Incentivizes for guessing and drawing',
        default: {base: null,
                  cost: null},
        description: 'If base is not null, participants receive a bonus for guessing the right urn. If cost is not null, the base bonus decreases by the cost for every draw'
      },
      socialData: {
        type: jsPsych.plugins.parameterType.OBJECT,
        pretty_name: 'Social data',
        default: {},
        description: 'Social data from previous generation'
      },
      generation: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Generation',
        default: 0,
        description: 'What generation in the diffusion chain this participant is.'
      }
    }
  };

  plugin.trial = function(display_element, trial){

    //If not specified, randomize these choices 0 or 1
    trial.urnChoice = trial.urnChoice || Math.floor(Math.random()*2);
    trial.rightAnswer = trial.rightAnswer || Math.floor(Math.random()*2);

    // check if p5 script is loaded
    if (window.p5){
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
    if (window.d3){
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

    // set up basic html for trial

    var advanceButton = '<div id="buttonFlexContainer"><button type="button" id="advanceButton">Next</button></div>';

    var html = '<style id="jspsych-beadTask-css"></style>';
    html += '<div id="estimateContainer" class="container" style="height:250px;width:800px"><svg id="chart"></svg></div>';
    html += '<div id="topHalf" style="position:relative;width:800px;height:120px;">';
    html += '<div id="instructionsContainer" style="position:absolute;width:100%;bottom:0;">';
    html += '<span id="instructions"></span>';
    html += '<div id="buttonContainer">'+advanceButton+'</div></div></div>';
    html += '<div id="bottomHalf">';
    html += '<div id="mainSketchContainer" class="container" style="height:330px;"></div></div>';

    display_element.innerHTML = html;

    // add condition-dependent html

    if( !trial.sequential ) {
      //limit choices to whatever is lowest out of: number of beads in urn and however many beads they could draw without getting a negative bonus
      var limit;
      if (trial.incentive.cost > 0){
        limit = Math.min(trial.beadCount, trial.incentive.base/trial.incentive.cost);
      } else {
        limit = trial.beadCount;
      }
      var chooseNInput = '<input type="text" id="chooseNInput" name="chooseNInput" size="3" placeholder="1-'+limit+'"></input>';
      var chooseNAlertMessage = "Please enter a number between 1 and " + limit;
      $('#instructions').after(chooseNInput);
      $('#chooseNInput').hide();
    }

    // create object to hold data

    var trial_data = {
      rts: []
    };

    if( trial.graded ){
      trial_data.confidenceDegree = [];
    }

/*
Objects for transitioning between trial stages
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
        successor: function(){

          if( trial.training ){
            //training
            if( instructions.index < instructions.tags.length-1 ){
              return 'instructions';
            } else {
              return 'drawBead';
            }

          } else {
            //actual trial
            if( instructions.index < instructions.tags.length-1 ){
              return 'instructions';
            } else if( trial.graded ){
                return 'confidence';
              } else if( trial.sequential | !trial.allowChoice ){
                  return 'drawBead';
                } else {
                  return 'chooseN';
                }
          }

        },
        instructions: '',
        button: function(){
          if(trial.pickUrn & instructions.tags[instructions.index]=='pick' ){
            return '';
          } else {
            return advanceButton;
          }},
        onClick: function(e){

          $('#instructionsContainer').css('display', 'none');

          instructionTag = instructions.tags[instructions.index];

          trial_data.rts.push({instructionTag: Date.now()-start_time});

          switch( instructionTag ){

            case 'color':

              trialControl.advance();

            break;

            case 'randomize':

              trialControl.advance();

            break;

            case 'drop':

              dropBeads = true;
              $('#instructionsContainer').css("display", "none");

            break;

            case 'shuffle':

              shuffleUrns = true;
              $('#instructionsContainer').css("display", "none");

            break;

            case 'pick':

              if( ! trial.pickUrn ){

                if( trial.urnChoice < 1 ){
                  urn2.startFade = true;
                  beadStart = drawPosition(urn1);
                } else {
                  urn1.startFade = true;
                  beadStart = drawPosition(urn2);
                }

              }

            break;

          }

        },
        setup: function(){

          this.instructions = instructions.step();
          $('#instructionsContainer').fadeIn(100);
        }
      },

      'chooseN': {
        successor: function(){
          return 'drawBead';
        },
        button: advanceButton,
        instructions: function(){
          if( trial.incentive.cost > 0 ){
            return 'How many beads would you like to draw from this urn before deciding which set of beads was dropped in here? That number of beads will then be drawn one by one from the urn. The first draw is free, but each subsequent draw decreases your bonus for guessing right by $'+trial.incentive.cost + '. ';
          } else{
            return 'How many beads would you like to draw from this urn before deciding which set of beads was dropped in here? That number of beads will then be drawn one by one from the urn. ';
          }
        },
        onClick: function(e){

          var drawChoice = $('#chooseNInput').val().replace(/[^\w]/gi, '');

          if( drawChoice.length > 0 ){
            if( drawChoice.match('[^0-9]') ){

              alert("Please enter numbers only.");

            } else {

              trial_data.rts.push({'chooseN': Date.now()-start_time});
              drawChoice = parseInt(drawChoice, 10);
              trial_data.drawChoice = drawChoice;
              trial.drawCount = drawChoice;
              $('#chooseNInput').hide();

              // if parameter trial.draws isn't long enough, fill it up with random draws to equal the number of draws chosen by the participant
              if( trial.draws.length < trial.drawCount ){
                var extra = trial.drawCount - trial.draws.length;
                var extraDraws = ratioArray(extra, trial.colorRatio, trial.rightAnswer);
                trial.draws = trial.draws.concat(extraDraws);
                trial_data.draws = trial.draws;
              }

              //adjust bonus
              if( trial.incentive.base > 0 ){
                currentBonus = (trial.incentive.base - (drawChoice-1)*trial.incentive.cost).toFixed(2); //first one is free
              }

              trialControl.advance();

            }
          } else {

            alert(chooseNAlertMessage);

          }

        },
        setup: function(){

          $('#instructionsContainer').fadeIn(100);
          $('#chooseNInput').fadeIn(100);

        }
      },

      'drawBead': {
        successor: function(){
          return  'returnBead';
        },
        button: advanceButton,
        instructions: function(){
                if( trial.training ){
                  return 'Beads will only be drawn from this <b>one, randomly chosen</b> urn. The aim is to draw beads from this urn until you are confident what the <b>majority color</b> in this urn is.';
                } else {
                  return 'Click to draw a bead from the urn.';
                }
        },
        onClick: function(e){

          trial_data.rts.push({'drawBead': Date.now()-start_time});
          beadReady = true;//?
          bead = new drawnBead(currentDraw, beadStart);
          $('#instructionsContainer').css('display', 'none');
          firstDraw = false;

        },
        setup: function(){

          $('#instructionsContainer').fadeIn(100);
          drawDirection = 'out';

          if( firstDraw == false ){
            if( trial.sequential & trial.allowChoice ){
              $('#instructionsContainer').css("display", "none");
            } else {
              $('#instructionsContainer').fadeIn(100);
            }
          }
        }
      },

      'returnBead': {
        successor: function(){
          if( trial.training ){
            return 'finalInstructions';
          } else {
            // actual trial
            if( trial.graded ){
              return 'confidence';
            } else {
                if( currentDraw >= trial.drawCount ){
                  return 'decide';
                } else {
                  if( trial.sequential & trial.allowChoice ){
                    if( trial.generation > 0 ){
                        return 'showGraph';
                    } else {
                      return 'chooseAction';
                    }
                  } else {
                    return 'drawBead';
                  }
                }
            }
          }
        },
        button: advanceButton,
        instructions: function(){
          if( trial.training ){
            var instructionString = 'Whenever a bead is drawn, we will <b>put it back</b> in the urn. '+
            'This means that the <b>number of beads</b> and the <b>ratio of bead colors</b> in the urn will <b>stay the same</b> throughout the whole task. '+
            'It also means that the same bead <b>might</b> be drawn more than once. ';
            if( trial.record ){
              instructionString += 'We will also keep a record of previous draws.';
            }
            return instructionString;
          } else {
            if( trial.record ){
              return 'Click to <b>record</b> the color of this bead, and then put it back in the urn.';
            } else {
              return 'Click to <b>return</b> the bead to the urn.';
            }

          }

        },
        onClick: function(e){

          trial_data.rts.push({'returnBead': Date.now()-start_time});
          $('#instructionsContainer').css('display','none');
          drawDirection = 'in';
          currentDraw += 1;
        },
        setup: function(){
          $('#instructionsContainer').fadeIn(100);
        }
      },

      'showGraph': {
        successor: function(){return 'chooseAction';},
        button: advanceButton,
        instructions: function(){
          var beadString;
          if(currentDraw==1){
            beadString = "(after 1 bead)."
          } else {
            beadString = "(after "+currentDraw+" beads)."
          }
          return "Here is the range of previous participants' choices. In dark red are the participants who already decided by this point "+beadString;
        },
        onClick: function(e){
          trialControl.advance();
        },
        setup: function(){
          $('#instructionsContainer').fadeIn(100, function(){
            $('#chart').fadeIn(100);
            renderChart(currentDraw);
          });
        }
      },

      'confidence': {
        successor: function(e){

          if( currentDraw == trial.drawCount ){
            return 'decide';
          } else if( trial.sequential ) {
            if( currentDraw > 0 & trial.allowChoice ){
              return 'chooseAction';
            } else {
              return 'drawBead';
            }
          } else {
            if( currentDraw > 0 | !trial.allowChoice ){
              return 'drawBead';
            } else {
              return 'chooseN';
            }
          }
        },
        button: advanceButton,
        instructions: function(){return confidenceInstructions;},
        onClick: function(e){
          if( slider.thumbCreated ){

            trial_data.rts.push({'confidence': Date.now()-start_time});
            trial_data.confidenceDegree.push(currentConfidenceDegree);
            trialControl.advance();
            $('#instructions').css('font-size', '18px');
            firstRating = false;
          } else {
            alert("Please click somewhere along the bar to indicate your confidence in which color is the majority color in this urn");
          }
        },
        setup: function(){
          $('#instructions').css('font-size', '15px');
          $('#instructionsContainer').fadeIn(100);

        }
      },

      'chooseAction': {
        successor: function(e){
          if( buttonChoice == 'drawButton' ){
            return 'drawBead';
          } else if( buttonChoice == 'decideButton' ){
            return 'decide';
          }
        },
        button: '<div id="buttonFlexContainer"><button type="button" id="drawButton">Draw another bead from this urn</button></div> <div id="buttonFlexContainer"><button type="button" id="decideButton">Decide which urn this is</button></div>',
        instructions: function(){
          if( trial.incentive.cost > 0){
            return 'Would you like to see any more beads or have you decided which urn this is? If you decide and get it right, your bonus would be <b>$' + currentBonus + '</b>. If you would like to see another bead before deciding, your potential bonus decreases by $' + trial.incentive.cost;
          } else {
              return 'Would you like to see any more beads or have you decided which urn this is?';
          }
        },
        onClick: function(e){

          trial_data.rts.push({'chooseAction': Date.now()-start_time});
          buttonChoice = e.target.id;
          if( buttonChoice == 'drawButton' & trial.incentive.cost > 0 ){
            currentBonus = (currentBonus - trial.incentive.cost).toFixed(2);
          }
          drawDirection = 'out';
          beadReady = true;
          bead = new drawnBead(currentDraw, beadStart);
          if( trial.generation > 0 ){
              $('#chart').fadeOut(300, trialControl.advance());
          } else {
            trialControl.advance();
          }

        },
        setup: function(){
          $('#instructionsContainer').fadeIn(100);
        }
      },

      'decide': {
        successor: function(){
          return 'feedback';
        },
        button: function(){
          return '<div id="buttonFlexContainer"><button type="button" id="chooseLeft" class="color_1 chooseButton"></button></div> <div id="buttonFlexContainer"><button type="button" id="chooseRight" class="color_2 chooseButton"></button></div>';
        },
        instructions: 'What do you think the majority color of the set of beads in this urn is?',
        onClick: function(e){
          var choice;
          buttonChoice = e.target.id;
          if( buttonChoice == 'chooseLeft' ){
            choice = 0;
          } else if( buttonChoice == 'chooseRight') {
            choice = 1;
          } else {
            choice = 'NA';
            console.log('Button choice not recorded');
          }
          var end_time = Date.now() - start_time;
          trial_data.rts.push({'end': end_time});
          trial_data.choice = choice;
          trial_data.drawsToDecision = currentDraw;
          trial_data.bonus = currentBonus;
          trial_data.maxDraws = trial.drawCount;
          trial_data.colorRatio = trial.colorRatio;
          trial_data.beadCount = trial.beadCount;
          trial_data.record = trial.record;
          trial_data.graded = trial.graded;
          trial_data.sequential = trial.sequential;
          trial_data.incentive = trial.incentive;
          trial_data.urnChoice = trial.urnChoice;
          trial_data.correct = trial.rightAnswer==trial_data.choice;

          console.log(trial_data);


          if(!trial.feedback){
            // clear display
            display_element.innerHTML = '';
            mainSketch.remove();
            gradedEstimateSketch.remove();
            jsPsych.finishTrial(trial_data);
          } else {
            trialControl.advance();
          }

        },
        setup: function(){

          $('#instructionsContainer').show();

        }
      },
      'feedback': {
        successor: function(){
          return 'end';
        },
        button: '<div id="buttonFlexContainer"><button type="button" id="advanceButton">Click to move on to the next trial</button></div>',
        instructions: function(){
          var feedbackString = 'The majority color in this urn was <span class="right_answer">this</span>, so you were ';
          var correctString = function(){
                                if(trial_data.correct){
                                  return 'correct. ';
                                } else {
                                  return 'incorrect. ';
                                }
                              };
          var bonusString = function(){
            if(trial.incentive.base > 0 & trial_data.correct){
                return 'Your bonus for this trial is $'+currentBonus+'.';
            } else {
              return '';
            }
          };
          return feedbackString+correctString()+bonusString();
        },
        onClick: function(e){
          jsPsych.finishTrial(trial_data);

          display_element.innerHTML = '';
          mainSketch.remove();
          gradedEstimateSketch.remove();
        },
        setup: function(){

          $('#instructionsContainer').show();

        }

      },
      'finalInstructions': {
        successor: function(){
          return 'end';
        },
        button: '<div id="buttonFlexContainer"><button type="button" id="advanceButton">Click to advance</button></div>',
        instructions: "In this example, we drew just one bead, but in the actual trials, you may see more",
        onClick: function(e){
          trial_data = {};
          var end_time = Date.now();
          trial_data.rt = end_time - start_time;
          jsPsych.finishTrial(trial_data);
          display_element.innerHTML = '';
          mainSketch.remove();
          gradedEstimateSketch.remove();
        },
        setup: function(){

          $('#instructionsContainer').show();

        }
      }

    };

    var trialControl = {
      /*
      Object for handling transitions around trialGraph, and calling appropriate functions for setup and whatever stage we're on
      */

      stage: null,
      data: null,

      initialize: function(x){
        this.stage = x;
        this.populate();
        this.data.setup();
        this.updateInstructions();
      },
      populate: function(){
        this.data = trialGraph[this.stage];
      },
      advance: function() {
        var nextStage = this.data.successor();
        instructions.index+=1;
        this.stage = nextStage;
        this.populate();
        this.data.setup();
        this.updateInstructions();
        this.updateButtons();
      },
      updateButtons: function() {
        $('#buttonContainer').html(this.data.button);
      },
      updateInstructions: function(){
        $('#instructions').html(this.data.instructions);
      },

    };

    var instructionsTraining = ["In this task, we will color some beads black and some beads white. We'll drop beads of both colors into <b>two separate urns</b>.",
                     'One urn will be majority black and the other will be majority white, though each urn will have <b>some</b> beads of each color.',
                     'The beads are shuffled and then dropped in the urns.',
                     'Next, we will shuffle the urns <b>thoroughly</b> so you will initially have <b>no idea</b> which of these urns contains mostly black beads and which contains mostly white.',
                     "Then we will pick one of these urns. You initially have no idea which it is. Then we will start drawing beads from whichever urn gets picked."];

    var instructionsTrial = ['Click to color the beads in the ratio ' + Math.round(trial.colorRatio*100) + ':' + Math.round((1-trial.colorRatio)*100),
                     'Click to shuffle the beads',
                     'Click to drop the beads in the urns',
                     'Click to shuffle the urns',
                     'Click to pick a RANDOM urn. After this, all beads will be drawn from this one urn.'];

    var instructions = {
      /*
      This object contains data about the instructions displayed during setup
      */
      instructionSet: [],
      tags: ['color', 'randomize', 'drop', 'shuffle', 'pick'],
      index: 0,
      step: function(){
        return this.instructionSet[this.index];
      },

    };

    if( trial.training ){
      instructions.instructionSet = instructionsTraining;
    } else {
      instructions.instructionSet = instructionsTrial;
    }

    trialControl.initialize('instructions');
    if( trial.pickUrn & !trial.training ){
      instructions.instructionSet[4] = 'Click on one of these RANDOMLY shuffled urns to pick it.';
    }

/*
Trial functions
*/

    var complementaryColor = function(RGBcolor){
      // Find the complementary color of an RGB color in format [red, green, blue]
      var newColors = [];
      RGBcolor.forEach(function(element) {
        newColors.push(255-element);
      });
      return newColors;
    };

    function shuffle(unshuffled){
      // shuffle an array
      var shuffled = [];
      var N = unshuffled.length;
      for( var i = 0; i < N; i++ ){
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
      for (var i = 0; i < arrayLength; i++){
        if (i < colorRatio*arrayLength) {
          binaryArray.push(direction);
        } else {
          binaryArray.push(1-direction*1);
        }
      }
      return binaryArray;
    }

    function rgbString(colorTriple){
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
    var slider;

    // renderChart(3);


    var confidenceInstructions = function(){
      if(firstRating) {
        return "How likely do you think it is that either of these is the <b>majority color</b> in this <b>urn</b>? "+
               "In the middle means you are completely unsure - you think there's a 50:50 chance it could be either color. " +
               "Clicking on either extreme means there's a 100% chance <b>that</b> color is the majority. Click along the bar to make your rating, then drag to adjust. "+
               "When you're ready to submit your rating, click Next.";
      } else {
        return "Please rate how likely it is that either of these is the <b>majority color</b> in this <b>urn</b>.";
      }
    };

    var sketchWidth = $('#mainSketchContainer').css('width').match(/\d+/);
    var sketchHeight = 330;
    var urnMargin = 120;
    var urnWidth = 135;
    var urnHeight = 160;
    var currentDraw = 0;
    var endY = 30;
    var endX = sketchWidth/2;
    var drawDirection = 'out';
    var canContinue = true;
    var beadStartHeight = 100;
    var beadDiameter = 7;
    var firstDraw = true;
    var firstRating = true;
    var currentConfidenceDegree = 50;
    var dropBeads = false;
    var shuffleUrns = false;
    var startFade = false;

    // variables that depend on setup parameters

    var ratioString = Math.round(trial.colorRatio*100) + ':' + Math.round((1-trial.colorRatio)*100);

    var colors = [trial.firstColor, complementaryColor(trial.firstColor)];

    if ( trial.incentive.base > 0 ){
      var currentBonus = trial.incentive.base;
    }

    if( trial.draws.length == 0){
      // If no order of draws is specified, create a random array of 0s and 1s in the ratio specified

      var draws = ratioArray(trial.drawCount, trial.colorRatio, trial.rightAnswer);
      trial.draws = shuffle(draws);

      // save draws to trial data
      trial_data.draws = trial.draws;

    } else {

      // if some draws are specified, replace the randomly chosen trial.rightAnswer with whatever is in the majority in trial.draws
      var total = 0;
      trial.draws.forEach(function(e){
        total+=e;
      });
      if( total != trial.draws.length/2){ //check there is a majority (otherwise leave it random)

        if( total > trial.draws.length/2 ){
          trial.rightAnswer = 1;
        } else {
          trial.rightAnswer = 0;
        }

      }

      // adjust to whichever is the highest out of trial.drawCount and trial.draws.length
      if( trial.drawCount != trial.draws.length ) {

        if( trial.drawCount < trial.draws.length ){
          trial.drawCount = trial.draws.length;
        } else {
          var shortFall = trial.drawCount - trial.draws.length;
          var additionalDraws = ratioArray(shortFall, trial.colorRatio, trial.rightAnswer);
          var additionalDrawsShuffled = shuffle(additionalDraws);
          additionalDrawsShuffled.forEach(function(e){
            trial.draws.push(e);
          });
        }
      }
    }

    var cssString = '.color_1 {background-color: '+ rgbString(colors[0])+'}';
    cssString += '.color_2 {background-color: '+ rgbString(colors[1])+'}';
    cssString += '.right_answer {background-color: '+ rgbString(colors[trial.rightAnswer])+'}';
    cssString += '.chooseButton {padding: 15px 32px}';
    cssString += '#buttonContainer {text-align: center; height: 25px}';
    cssString += '#buttonFlexContainer {text-align: center; display: inline-block; width: 45%;}';
    cssString += 'button {display: inline-block; text-align: center;}';
    // cssString += '#estimateContainer {position: relative; left: 0; top: -250px; z-index: 1}';
    // cssString += '#buttonFlexContainer:after {content: ""; width: 100%; display: inline-block;}';
    $('#jspsych-beadTask-css').html(cssString);

/*
 P5.js Pseudo-classes for multiple sketches
*/

    function Urn(sketch, x, y, side, image) {

      this.sketch = sketch;
      this.position = sketch.createVector(x,y);
      this.side = side;
      this.direction = 1-2*this.side; //if on left, move to right, if on right, move to left
      this.velocity = sketch.createVector(this.direction*10,0);
      this.acceleration = sketch.createVector(this.direction,0); //?
      this.shakeVelocity = sketch.createVector(10, 0);
      this.moves = 0;
      this.visible = 1;
      this.alpha = 255;
      this.picked = false;
      this.startFade = false;

      if( image != null ){
        this.image = image;
      }

      this.checkPicked = function(){
        if(sketch.mouseX > this.position.x & sketch.mouseX < this.position.x+urnWidth & sketch.mouseY > this.position.y & sketch.mouseY < this.position.y + urnHeight){
          this.picked = true;
        }
      };

      this.display = function() {

        switch( instructions.tags[instructions.index] ) {

          case 'shuffle': //switch urns

            if( shuffleUrns == true ){
              if( sketch.abs(this.velocity.x) < 100 ) {
                this.velocity.add(this.acceleration);
              }
              if( this.moves < 10 ) {

                if( this.position.x > sketch.width-2*urnMargin | this.position.x < urnMargin){
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

            if( this.startFade == true ){
              if( this.alpha > 0 ){
                this.alpha-=5;
              } else {
                this.visible = 0;
                trialControl.advance();
              }
            }


        }

        if( this.visible == 1 ) {
          if( this.image.width <= 1 ){
            sketch.fill(150, this.alpha);
            sketch.stroke(0, this.alpha);
            sketch.rect(this.position.x, this.position.y, urnWidth, urnHeight, 0, 0, 20, 20);
          } else {
            sketch.stroke(255);
            if( instructions.index!=3 ){
              sketch.fill(255);
              sketch.rect(this.position.x, this.position.y, urnWidth, urnHeight);
            }
            sketch.image(urnImg, this.position.x+1, this.position.y, urnWidth, urnHeight);
            sketch.fill(255, 255-this.alpha);
            sketch.strokeWeight(0);
            sketch.rect(this.position.x, this.position.y, urnWidth+2, urnHeight);
            sketch.strokeWeight(1);
          }

        }
      };

    }

    function Beadset(sketch, urn, side) {

      this.sketch = sketch;

      if( urn != null ){
        this.urn = urn;
        this.anchor = sketch.createVector(this.urn.position.x + (urnWidth/2-(sketch.sqrt(trial.beadCount)-1)/2*beadDiameter), this.urn.position.y - beadStartHeight);
        this.direction = this.urn.side;
      } else {
        this.direction = side;
        this.anchor = sketch.createVector(beadDiameter/2+side*(sketchWidth-(sketch.sqrt(trial.beadCount)*beadDiameter)), beadDiameter/2);
      }

      this.beads = [];
      var beadColors = ratioArray(trial.beadCount, trial.colorRatio, this.direction);
      beadColorsShuffled =  sketch.shuffle(beadColors);

      for (var i = 0; i < trial.beadCount; i++) {
        this.beads[i] = new Bead(sketch, i, this.anchor, beadColors[i], beadColorsShuffled[i]);
      }

      this.display = function() {

        for (var i = 0; i < trial.beadCount; i++) { //
          if( dropBeads & sketch.parentId == 'mainSketchContainer'){
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

        if( trialControl.stage == 'instructions' ){

            switch( instructions.tags[instructions.index] ){

              case 'color':

                sketch.fill(140);
                sketch.stroke(140);

              break;

              case 'randomize':

                sketch.fill(this.color);
                if(trial.training){
                  sketch.stroke(100);
                } else {
                  sketch.stroke(this.color);
                }

              break;

              case 'drop':

                sketch.fill(this.shuffledColor);
                if(trial.training){
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

        if( this.invisible == false ){
          sketch.ellipse(this.position.x,this.position.y, beadDiameter-1, beadDiameter-1);
        }
      };

      this.drop = function() {
        if( this.position.y > 150 ) {
          this.dropped = 1;
          this.invisible = true;
        }
        this.velocity.add(this.acceleration);
        this.position.add(this.velocity);
      };

    }


    // A slider for giving a graded confidence estimate
    function Scrollbar(sketch, xPosition, yPosition){


      this.sketch = sketch;
      this.startX = sketch.width*xPosition;
      this.thumbX = sketch.width*xPosition;
      this.textX = sketch.width*xPosition;
      this.thumbY = sketch.height*yPosition;
      this.thumbColor = [128, 128, 128];
      this.valueLabel = '50:50';
      this.overThumb = false;
      this.thumbCreated = false;

      var mouseMargin = 6;
      var print = 0;


      this.display = function() {

        sketch.rectMode(sketch.RADIUS);

        // track
        sketch.fill(200);
        sketch.stroke(150);
        sketch.rect(sketch.width*xPosition, this.thumbY, 200, 5);

        // thumb
        if( this.thumbCreated ){
          sketch.fill(this.thumbColor);
          sketch.stroke(40);
          sketch.rect(this.thumbX,sketch.height*yPosition, 5, 8, 3, 3, 3, 3);
        }

        // label
        sketch.fill(0);
        sketch.strokeWeight(0);
        sketch.stroke(0);
        sketch.textAlign(sketch.CENTER);
        sketch.fill(150);
        if( $('#estimateContainer').attr('over') == 'true' ){
        sketch.text('100%\nchance',200,this.thumbY+20);
        sketch.text('75%\nchance',300,this.thumbY+20);
        sketch.text('50:50\nchance',400,this.thumbY+20);
        sketch.text('75%\nchance',500,this.thumbY+20);
        sketch.text('100%\nchance',600,this.thumbY+20);
        }
        if( this.thumbCreated & $('#estimateContainer').attr('over') == 'true' ){
          var labelParts = this.valueLabel.split(":");
          var fillLeft = ((100-labelParts[0])/50)*100;
          var fillRight = ((100-labelParts[1])/50)*100;
          sketch.fill(fillLeft);
          sketch.text(labelParts[0],this.textX-sketch.textWidth(labelParts[0])/1.35, this.thumbY-20);
          sketch.fill(120);
          sketch.text(":", this.textX, this.thumbY-20);
          sketch.fill(fillRight);
          sketch.text(labelParts[1],this.textX+sketch.textWidth(labelParts[1])/1.35, this.thumbY-20);
        }

        sketch.strokeWeight(1);

      };

      // move thumb if mouse drags thumb
      this.drag = function() {

        if( this.overThumb ) {

          if( sketch.mouseX < 600 & sketch.mouseX > 200 ){

            this.thumbX = sketch.mouseX;
            this.updateThumb();

          } else {

            if( sketch.mouseX <= 200 ) {
              this.thumbX = 200;
              this.updateThumb();
            } else {
              this.thumbX = 600;
              this.updateThumb();
            }

          }
        }
      };

      this.hooked = function() {

        if( sketch.abs(sketch.mouseX-this.thumbX) < mouseMargin & sketch.abs(sketch.mouseY-this.thumbY) < 20 ){
          this.overThumb = true;
        }

      };

      // move the slider thumb if mouse clicked on track
      this.move = function() {

        if( sketch.mouseX > 200 & sketch.mouseX < 600 & sketch.abs(sketch.mouseY-this.thumbY) < 20 ) {

            if( !this.thumbCreated ){
              this.thumbCreated = true;
              this.thumbX = sketch.mouseX;
            }
            this.thumbX = sketch.mouseX;
            this.updateThumb();

        }

      };

      this.stop = function() {

        this.overThumb = false;
        this.value = this.thumbX;

      };

      // adjust the thumb color to reflect similarity to the majority bead color
      this.updateThumb = function() {

        var confidenceDegree = Math.round(50+(this.thumbX-this.startX)/4);
        var confidenceLabel = sketch.abs(100-confidenceDegree) + ':' + confidenceDegree;

        // adjust thumb color to reflect degree of confidence
        var confidenceProportion = sketch.abs(this.thumbX-this.startX)/200;
        var confidenceDirection;
        if( this.thumbX > this.startX ){
          confidenceDirection = 1;
        } else {
          confidenceDirection = 0;
        }
        var targetColor = colors[confidenceDirection];
        var newColor = [];
        var colorDifference = targetColor.forEach(function(e,i){
          newColor.push(sketch.abs(128 + Math.floor(confidenceProportion*(e-128))));
        });

        this.thumbColor = newColor;

        // make the label a bit sticky around 50:50
        if( sketch.abs(confidenceDegree-50) < 2 ){
          this.valueLabel = '50:50';
        } else {
          this.valueLabel = confidenceLabel;
        }

        this.textX = this.thumbX;

        // store value
        currentConfidenceDegree = confidenceDegree;

      };
    }


/*
P5 sketches:
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

    // sketch functions & pseudo-classes

    function Record(){

      this.records = [];
      this.containerHeight = 20;
      this.xMargin = 20;
      this.beadSize = beadDiameter+4;
      this.xSlots = Math.floor((sketch.width-2*this.xMargin)/this.beadSize);
      // this.fill = 150;

      this.update = function(draw){
        this.records.push(draw);
      };

      this.display = function(){


        // label
        if( !trial.training ){
          sketch.fill(50);
          sketch.strokeWeight(0);
          sketch.text('Record of previously drawn beads', this.xMargin, sketch.height-this.containerHeight-10);
          sketch.strokeWeight(1);

        // records
          sketch.translate(this.xMargin, sketch.height-this.containerHeight);
          this.records.forEach(function(e, i){
            var xPos = 10+(record.beadSize)*(i % record.xSlots);
            var yPos = (record.beadSize)*Math.floor(i / record.xSlots);
            sketch.fill(colors[e]);
            sketch.stroke(240);
            sketch.ellipse(xPos, yPos, record.beadSize, record.beadSize);
          });
        }
      };
    }

    drawnBead = function(currentDraw, position){

      this.id = currentDraw;
      this.position = position.copy();
      this.startPosition = position.copy();
      this.color = colors[trial.draws[this.id]];

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


    drawPosition = function(urn){
      /*
      Work out where a drawn bead should first appear
      */
      startPosition = sketch.createVector(urn.position.x + 0.5*urnWidth, urn.position.y);
      return startPosition;
    };

     function pickUrn(){
       if(trial.pickUrn & instructions.tags[instructions.index]=='pick'){
         urn1.checkPicked();
         urn2.checkPicked();
         keepPick();
      }
    }

    function keepPick(){
      if( urn1.picked ) {
        urn2.startFade = true;
        beadStart = drawPosition(urn1);
      }
      if( urn2.picked ){
        urn1.startFade = true;
        beadStart = drawPosition(urn2);
      }
    }

    // set up sketch

    sketch.setup = function() {

      urnImg = sketch.loadImage('./img/greek-urn-md.png'); //image used under CC0 creative commons licence, http://www.clker.com/clipart-greek-urn-1.html
      var sketchCanvas = sketch.createCanvas(sketchWidth, sketchHeight);
      sketch.background(255);

      sketch.parentId = $(sketch.canvas).parent().attr('id');

      urn1 = new Urn(sketch, urnMargin, 120, 0, urnImg);
      urn2 = new Urn(sketch, sketch.width-2*urnMargin, 120, 1, urnImg);
      beadset1 = new Beadset(sketch, urn1);
      beadset2 = new Beadset(sketch, urn2);
      if(trial.record){
        record = new Record();
      }

      sketchCanvas.mousePressed(pickUrn);


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



      if(trial.record & record.records.length>0){
        record.display();
      }


    };
  }, 'mainSketchContainer');


/*
If graded confidence estimates are required, create additional sketch to display beadsets on either side of a slider input
*/

    var gradedEstimateSketch = new p5(function( sketch ){

      var sketchHeight = $('#estimateContainer').css('height').match(/\d+/);

      sketch.setup = function(){

        var sketchCanvas = sketch.createCanvas(sketchWidth, sketchHeight);

        sketch.background(255);
        sketch.fill(255);
        slider = new Scrollbar(sketch, 0.5,0.5,400);
      };



      sketch.draw = function(){

        sketch.background(255);


        if( trialControl.stage == 'confidence' ){

          sketch.rectMode(sketch.CENTER);
          sketch.fill(colors[0]);
          sketch.strokeWeight(0);
          sketch.rect(150,sketchHeight*0.5,50,50);
          sketch.fill(colors[1]);
          sketch.rect(650,sketchHeight*0.5,50,50);
          sketch.strokeWeight(1);
          slider.display();

        }

      };

      sketch.mouseDragged = function() {

        slider.drag();

      };

      sketch.mouseReleased = function() {

        slider.stop();

      };

      sketch.mouseClicked = function() {

        slider.move();

      };

      sketch.mousePressed = function() {

        slider.hooked();

      };

    }, 'estimateContainer');

    // start timer once sketches are loaded

    var start_time = Date.now();

/*
d3 functions for displaying social info
*/

function renderChart(cutoff){

  // size
  var svg = d3.select("svg")
    .attr("width", 800)
    .attr("height", 250);
  var margin = {top: 20, right: 20, bottom: 35, left: 40},
  chartWidth = +svg.attr("width") - margin.left - margin.right,
  chartHeight = +svg.attr("height") - margin.top - margin.bottom;

  // scales
  var x = d3.scaleBand().rangeRound([0, chartWidth]).padding(0.1),
  y = d3.scaleLinear().rangeRound([chartHeight, 0]);

  x.domain(data.map(function(d) { return d.decision; }));
  y.domain([0, d3.max(data, function(d) { return d.count; })]);

  // graph
  var g = svg.append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // x-axis
  g.append("g")
    .attr("class", "axis axis--x")
    .attr("transform", "translate(0," + chartHeight + ")")
    .call(d3.axisBottom(x))

  g.append("text")
    .attr("transform",
          "translate(" + chartWidth/2 + ", 230)")
    .attr("text-anchor", "middle")
    .style("font-size", "15px")
    .text("Number of beads drawn");

  // y-axis

  g.append("g")
    .attr("class", "axis axis--y")
    .call(d3.axisLeft(y)
      .tickValues(d3.range(0,10,1))
      .tickFormat(d3.format(".0s")))


  g.append("text")
  .attr("transform", "rotate(-90)")
  .attr("y", 0-margin.left)
  .attr("x", 0-(chartHeight/2))
  .attr("dy", "0.75em")
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text("Number of participants");

  g.append("text")
  .attr("transform", "rotate(-90)")
  .attr("y", 0-margin.left)
  .attr("x", 0-(chartHeight/2))
  .attr("dy", "1.75em")
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text("deciding after each draw");

  // bar data
  g.selectAll(".bar")
    .data(trial.socialData)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("passed", function(d){
      return d.decision<=cutoff})
    .attr("x", function(d) { return x(d.decision); })
    .attr("y", function(d) { return y(d.count); })
    .attr("width", x.bandwidth())
    .attr("height", function(d) { return chartHeight - y(d.count); });

}


/*
Input handlers
*/

  $("#buttonContainer").on("click", "button", function(e){
    // console.log(trialControl.stage);
    trialControl.data.onClick(e);

  });

  $("#buttonContainer").on("mousedown", "button", function(){
      if( trialControl.stage == 'returnBead'  ){
          record.update(trial.draws[currentDraw]);
      }
  });

  $("#chooseNInput").keydown(function(e){
    if( e.keyCode == 13 & trialControl.stage == 'chooseN' ){
      trialControl.data.onClick(e);
    }
  });

  $( '#estimateContainer' ).mouseenter( function(){
      $( this ).attr('over', true);
    }).mouseleave( function(){
      $( this ).attr('over', false);
  });

};

  return plugin;

})();
