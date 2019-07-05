var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AWS = require('aws-sdk');
var mysql = require('mysql');
var workerpool=[];


//var worker1 = 'i-0882bd0cca77baa0e'; //real worker1
var worker1 = 'i-057f57d12a316e607';  //nicerworker
var worker2 = 'i-0882bd0cca77baa0e';
var database = 'i-0322d7b14c2e77af0';
var Manager = 'i-0322d7b14c2e77af0';
var HW1 = 'i-024273b1543473d9a';

var protectInstances = [worker1,worker2,database,Manager,HW1];

var index = require('./routes/index');
var users = require('./routes/users');

var app = express();

AWS.config.loadFromPath('./config.json');
AWS.config.update({
    signatureVersion: 'v4'
});

var connection = mysql.createConnection ({

    host: 'localhost',
    user: 'root',
    password: '',
    database: 'autoscaling'

});
connection.connect(function(error){
    if (error){
        console.log('error!');
    }
    else{
        console.log('you are connected!');
    }
});



function checkcpu(callback) {

    var cloudwatch = new AWS.CloudWatch({apiVersion: '2010-08-01'});

    var endtime = new Date();
    var tm = new Date();

    var starttime = new Date(tm.setSeconds(tm.getSeconds() - 60 * 60));

    var starttimestr = starttime.toISOString();

    var endtime = endtime.toISOString();

    var params = {
        EndTime: endtime, /* required */
        MetricName: 'CPUUtilization', /* required */
        Namespace: 'AWS/EC2', /* required */
        Period: 60, /* required */
        StartTime: starttimestr, /* required */
        Dimensions: [
            {
                Name: 'InstanceId', /* required */
                Value: worker1 /* required */
            }

        ],

        Statistics: [
            'Average'
            /* more items */
        ],
        Unit: 'Percent'
    };
    cloudwatch.getMetricStatistics(params, function (err, data) {
        if (err) console.error(err, err.stack); // an error occurred
        else     {
          //console.log(data);
          callback(data.Datapoints);
        }
        // successful response
    });
}

function createec2(){
  var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
  var elb = new AWS.ELB({apiVersion: '2012-06-01'});

  var params = {
  ImageId: 'ami-2eaf7454', /* required */
  MaxCount: 1, /* required */
  MinCount: 1,
  InstanceType: 't2.small',
  Monitoring: {
    Enabled: true
  },
  SecurityGroupIds: [
    'sg-4e88da3c'
    /* more items */
  ],
  SecurityGroups: [
    'launch-wizard-4'
    /* more items */
  ]
};
ec2.runInstances(params, function(err, data) {
  if (err) console.error(err, err.stack); // an error occurred
  else     {
    console.log(data);
    var id = data.Instances;
    id=id[0].InstanceId;
    console.log(id);
    var params = {
  Instances: [
     {
    InstanceId: id
   }
  ],
  LoadBalancerName: "ece1779"
 };
 elb.registerInstancesWithLoadBalancer(params, function(err, data) {
   if (err) console.error(err, err.stack); // an error occurred
   else     console.log(data);           // successful response
 });
  }           // successful response
});
}

function destoryec2(id) {
    var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
    var elb = new AWS.ELB({apiVersion: '2012-06-01'});
     var params = {
  Instances: [
     {
    InstanceId: id
   }
  ],
  LoadBalancerName: "ece1779"
 };
 elb.deregisterInstancesFromLoadBalancer(params, function(err, data) {
   if (err) {}//console.error(err, err.stack); // an error occurred
   else    {
     //console.log(data);
  var params = {
  InstanceIds: [
      id
  ]
};
ec2.terminateInstances(params, function(err, data) {
  if (err) console.error(err, err.stack); // an error occurred
  //else
    //console.log(data);           // successful response
});

   }          // successful response
 });
}



function autoscaling(){
    connection.query('select upperbound,lowerbound,expandratio,shrinkratio from settings',function(err,result) {
        var cpuub = Number(result[0].upperbound);
        var cpulb = Number(result[0].lowerbound);
        var ER = Number(result[0].expandratio);
        var SR = Number(result[0].shrinkratio);
        var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
        var elb = new AWS.ELB({apiVersion: '2012-06-01'});
        var sizeup = 1;
        var sizedown = 0.5;
        var cpuult;
        var params = {
            LoadBalancerNames: [
                "ece1779"
            ]
        };
        elb.describeLoadBalancers(params, function (err, data) {
            if (err) console.error(err, err.stack); // an error occurred
            else {
                var data = data.LoadBalancerDescriptions;
                data = data[0].Instances;
                var size = 1;
                var numofinstances = data.length;
                var InstancesIds = [];
                for (i = 0; i < numofinstances; i += 1) {
                    InstancesIds.push(data[i].InstanceId);
                }
                for (i = 0; i < InstancesIds.length; i++) {
                    if (InstancesIds[i] !== worker1 && InstancesIds[i] !== worker2) {
                        size += 1;
                    }
                }
                var lastdata = '';
                checkcpu(function (ult) {
                    ult.sort(function (a, b) {
                        return new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime()
                    });
                    ult = ult.reverse();
                    lastdata = ult[0].Average;
                    console.log(lastdata);
                    if (lastdata >= cpuub) {
                        for(var i=0;i<ER*size;i++) {
                            createec2();
                        }
                    }
                    if (lastdata <= cpulb) {
                        if(SR ===1){
                            if(InstancesIds[0]!==worker1){
                                destoryec2(InstancesIds[0]);
                            }
                            else destoryec2(InstancesIds[1])
                        }
                        if(SR!==1) {
                            for (var j = 0; j < size * (1 - 1 / SR); j++) {
                                if (InstancesIds[0] !== worker1) {
                                    destoryec2(InstancesIds[0]);
                                }
                                else destoryec2(InstancesIds[1])
                            }
                        }
                    }
                })
            }
        })
    })
}


setInterval(function(){
    autoscaling();
}, 30000);











// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.listen(5001, function () {
  console.log('app listening on port 5001')
});

var app2 =app;
module.exports = app2;