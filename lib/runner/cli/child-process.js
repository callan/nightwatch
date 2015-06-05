var execFile = require('child_process').execFile;
var Logger = require('../../util/logger.js');

function ChildProcess(environment, index, env_output, settings, args) {
  this.env_output = env_output || [];
  this.mainModule = process.mainModule.filename;
  this.index = index;
  this.itemKey = this.getChildProcessEnvKey(environment);
  this.startDelay = settings.parallel_process_delay || ChildProcess.defaultStartDelay;
  this.environment = environment;
  this.settings = settings;
  this.child = null;
  this.globalExitCode = 0;
  this.processRunning = false;
  this.args = args || [];
}

ChildProcess.prevIndex = 0;
ChildProcess.defaultStartDelay = 10;

ChildProcess.prototype = {
  run : function(colors, done) {
    this.availColors = colors;

    var cliArgs = this.getArgs();
    var env = process.env;
    var self = this;

    setTimeout(function() {
      env.__NIGHTWATCH_PARALLEL_MODE = 1;
      env.__NIGHTWATCH_ENV = self.environment;
      env.__NIGHTWATCH_ENV_KEY = self.itemKey;

      self.child = execFile(process.execPath, cliArgs, {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: env
      }, function (error, stdout, stderr) {});

      self.processRunning = true;

      if (self.settings.output) {
        console.log('Started child process for environment:',
          self.settings.disable_colors ? (' ' + self.environment + ' ') :
            (Logger.colors.yellow(' ' + self.environment + ' ', Logger.colors.background.black)), '\n');
      }

      self.child.stdout.on('data', function (data) {
        self.writeToStdout(data);
      });

      self.child.stderr.on('data', function (data) {
        self.writeToStdout(data);
      });

      self.child.on('close', function(code) {
        done(self.env_output, self.globalExitCode);
      });

      self.child.on('exit', function (code) {
        if (code) {
          self.globalExitCode = 2;
        }
        self.processRunning = false;
      });


    }, this.index * this.startDelay);
  },

  getChildProcessEnvKey : function(env) {
    return env + '_' + (this.index+1);
  },

  /**
   * Returns an array of cli arguments to be passed to the child process,
   * based on the args passed to the main process
   * @returns {Array}
   */
  getArgs : function() {
    var args = [this.mainModule];
    for (var i = 2; i < process.argv.length; i++) {
      if (process.argv[i] == '-e' || process.argv[i] == '--env') {
        i++;
      } else {
        args.push(process.argv[i]);
      }
    }

    args.push.apply(args, this.args);
    args.push('--parallel-mode');

    return args;
  },

  writeToStdout : function(data) {
    data = data.trim();

    var color_pair = this.availColors[this.index%4];
    var output = '';

    if (ChildProcess.prevIndex !== this.index) {
      ChildProcess.prevIndex = this.index;
      if (this.settings.live_output) {
        output += '\n';
      }
    }


    if (this.settings.disable_colors) {
      output += ' ' + this.environment + ' ';
    } else {
      output += Logger.colors[color_pair[1]](' ' + this.environment + ' ',
        Logger.colors.background[color_pair[0]]);
    }

    output += '  ' + data;

    if (this.settings.live_output) {
      process.stdout.write(output + '\n');
    } else {
      this.env_output.push(output);
    }
  }
};

module.exports = ChildProcess;