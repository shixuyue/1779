var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AWS = require('aws-sdk');
var workerpool=[];
var mysql = require('mysql');
var multerS3 = require('multer-s3');
var multer = require('multer');


//ar worker1 = 'i-0882bd0cca77baa0e'; //real worker1
var worker1 = 'i-057f57d12a316e607';  //nicerworker
var worker2 = 'i-0882bd0cca77baa0e';
var database = 'i-0322d7b14c2e77af0';
var Manager = 'i-0322d7b14c2e77af0';
var HW1 = 'i-024273b1543473d9a';

var protectInstances = [worker1,worker2,database,Manager,HW1];

var index = require('./routes/index');
var users = require('./routes/users');

var app = express();
app.use(express.static(__dirname + '/'));
AWS.config.loadFromPath('./config.json');
AWS.config.update({
    signatureVersion: 'v4'
});

var connection = mysql.createConnection ({

    host: '172.31.78.195',
    user: 'ece1779',
    password: 'secret',
    database: 'autoscaling'

});

var connectionS3 = mysql.createConnection({
    host:'172.31.78.195',
    user:'ece1779',
    password:'secret',
    database:'userinfohash'
});

connection.connect(function(error){
    if (error){
        console.log('error!');
    }
    else{
        console.log('you are connected!');
    }
});

connectionS3.connect(function(error){
   if(error){
       console.error('error!');
   }
   else{
       console.log('you are connected to user database');
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
   if (err) console.error(err, err.stack); // an error occurred
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


function test() {

   var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
   var params = {
  InstanceIds: [
    'i-00b8edb5f1ba3b30f'
    /* more items */
  ]
};
ec2.describeInstances(params, function(err, data) {
  if (err) console.error(err, err.stack); // an error occurred
  else     console.log(data.Reservations[0].Instances[0]);           // successful response
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


function emptybucket() {
    var s3 = new AWS.S3({apiVersion: '2006-03-01'});

    var params = {
        Bucket: "ece1779a2"
    };
    s3.listObjectsV2(params, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            var contents = [];
            var a = data.Contents;
            //console.log(a);

            for (var i = 0; i < a.length; i++) {
                contents[i] = a[i].Key;
            }
            //console.log(contents);

            for (var i = 0; i < contents.length; i++) {
                var params = {
                    Bucket: "ece1779a2",
                    Delete: {
                        Objects: [{
                            Key: contents[i]
                        }
                        ],
                        Quiet: false
                    }
                };
                s3.deleteObjects(params, function (err, data) {
                    if (err) console.error(err, err.stack); // an error occurred
                    else {
                        connectionS3.query(" delete from users where username !='TA'",function(err,date){
                            if(err) console.error(err);
                        });
                        connectionS3.query(" update users set images = '|' where username ='TA'",function(err,date){
                            if(err) console.error(err);
                        })
                    }           // successful response
                });
            }           // successful response
        }
    });
}










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
//app.use('/users', users);




app.get('/ec2list',function(req,res){

    var elb = new AWS.ELB({apiVersion: '2012-06-01'});
    var params = {
        LoadBalancerNames: [
            "ece1779"
        ]
    };
    elb.describeLoadBalancers(params, function (err, data) {
        if (err) console.error(err, err.stack);
        else {
                connection.query('select upperbound,lowerbound,expandratio,shrinkratio from settings',function(err,result){
                if(err) console.error(err);
                var InstanceIds=[];
                console.log(result[0]);
                var AZ=[];

                //console.log(data.LoadBalancerDescriptions[0].Instances);
                for(var i=0;i<data.LoadBalancerDescriptions[0].Instances.length;i++) {
                    InstanceIds[i] = data.LoadBalancerDescriptions[0].Instances[i].InstanceId;
                    AZ[i] = data.LoadBalancerDescriptions[0].AvailabilityZones[i];
                }
                //console.log(InstanceIds);
                res.render('list', {
                    InstanceIds: InstanceIds,
                    AZ: AZ,
                    ub: result[0].upperbound,
                    lb: result[0].lowerbound,
                    ER: result[0].expandratio,
                    SR: result[0].shrinkratio
                })
            })
        }
    });

});

app.get('/',function(req,res){
    res.render('main');
});

app.get('/s3list',function(req,res){
    var s3 = new AWS.S3({apiVersion: '2006-03-01'});
    var params = {};
         s3.listBuckets(params, function(err, data) {
           if (err) console.log(err, err.stack); // an error occurred
           else     {
               var bucketname=[];
               var createdate=[];
               for(var i=0;i<data.Buckets.length;i++){
                    bucketname[i]=data.Buckets[i].Name;
                    createdate[i]=data.Buckets[i].CreationDate;
               }
               res.render('bucketlist',{
                   bucketname: bucketname,
                   createdate: createdate
               });
           }
         });

});

app.post('/s3view',function(req,res){
    var s3 = new AWS.S3({apiVersion: '2006-03-01'});
    var bucketname = req.body.bucketname;
    var params = {
  Bucket: bucketname
 };
 s3.listObjectsV2(params, function(err, data) {
   if (err) console.log(err, err.stack); // an error occurred
   else     {
       var Key=[];
       var Size=[];
       var LastModified=[];
       for (var i=0;i<data.Contents.length;i++) {
           Key[i]=data.Contents[i].Key;
           Size[i]=data.Contents[i].Size;
           LastModified[i]=data.Contents[i].LastModified;
       }
       res.render('s3view',{
           Key: Key,
           Size: Size,
           LastModified: LastModified
           });
   }           // successful response

 });


});

app.get('/view',function(req,res){
   res.render('view');
});


app.post('/grabcpu',function(req,res){
    var instanceid = req.body.id;

    var cloudwatch = new AWS.CloudWatch({apiVersion: '2010-08-01'});

    var endtime = new Date();
    var tm = new Date();

    var starttime = new Date(tm.setSeconds(tm.getSeconds() - 60 * 60));

    var starttimestr = starttime.toISOString();

    var endtime = endtime.toISOString();

    function grabcpu(callback) {
        var params = {
            EndTime: endtime,
            MetricName: 'CPUUtilization',
            Namespace: 'AWS/EC2',
            Period: 60,
            StartTime: starttimestr,
            Dimensions: [
                {
                    Name: 'InstanceId',
                    Value: instanceid
                }

            ],

            Statistics: [
                'Average'

            ],
            Unit: 'Percent'
        };
        cloudwatch.getMetricStatistics(params, function (err, data) {
            if (err) console.error(err, err.stack); // an error occurred
            else {
                //console.log(data);
                callback(data.Datapoints);
            }
            // successful response
        });
    }

    grabcpu(function(ult){
     ult.sort(function(a,b) {
    return new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime()
        });
        var x=[];
        var y=[];

    for(var i=0; i<ult.length; i++){
        x[i]=ult[i].Timestamp;
        y[i]=ult[i].Average;
    }
        var result={time:x,average:y};
    res.send(result);
    });



});


app.post('/grabNI',function(req,res){
    var instanceid = req.body.id;

    var cloudwatch = new AWS.CloudWatch({apiVersion: '2010-08-01'});

    var endtime = new Date();
    var tm = new Date();

    var starttime = new Date(tm.setSeconds(tm.getSeconds() - 60 * 60));

    var starttimestr = starttime.toISOString();

    var endtime = endtime.toISOString();

    function grabNI(callback) {
        var params = {
            EndTime: endtime,
            MetricName: 'NetworkIn',
            Namespace: 'AWS/EC2',
            Period: 60,
            StartTime: starttimestr,
            Dimensions: [
                {
                    Name: 'InstanceId',
                    Value: instanceid
                }

            ],

            Statistics: [
                'Sum'

            ],
            Unit: 'Bytes'
        };
        cloudwatch.getMetricStatistics(params, function (err, data) {
            if (err) console.error(err, err.stack); // an error occurred
            else {

                callback(data.Datapoints);
            }
            // successful response
        });
    }

    grabNI(function(ult){
        console.log(ult);
     ult.sort(function(a,b) {
    return new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime()
        });
     console.log(ult[0].Sum);
        var x=[];
        var y=[];

    for(var i=0; i<ult.length; i++){
        x[i]=ult[i].Timestamp;
        y[i]=ult[i].Sum;
    }
    console.log(x,y);
        var result={time:x,average:y};
    res.send(result);
    });



});




app.post('/grabNO',function(req,res){
    var instanceid = req.body.id;

    var cloudwatch = new AWS.CloudWatch({apiVersion: '2010-08-01'});

    var endtime = new Date();
    var tm = new Date();

    var starttime = new Date(tm.setSeconds(tm.getSeconds() - 60 * 60));

    var starttimestr = starttime.toISOString();

    var endtime = endtime.toISOString();

    function grabNO(callback) {
        var params = {
            EndTime: endtime,
            MetricName: 'NetworkOut',
            Namespace: 'AWS/EC2',
            Period: 60,
            StartTime: starttimestr,
            Dimensions: [
                {
                    Name: 'InstanceId',
                    Value: instanceid
                }

            ],

            Statistics: [
                'Sum'

            ],
            Unit: 'Bytes'
        };
        cloudwatch.getMetricStatistics(params, function (err, data) {
            if (err) console.error(err, err.stack); // an error occurred
            else {
                //console.log(data);
                callback(data.Datapoints);
            }
            // successful response
        });
    }

    grabNO(function(ult){
     ult.sort(function(a,b) {
    return new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime()
        });
     console.log(ult[0].Sum);
        var x=[];
        var y=[];

    for(var i=0; i<ult.length; i++){
        x[i]=ult[i].Timestamp;
        y[i]=ult[i].Sum;
    }
    console.log(x,y);
        var result={time:x,average:y};
    res.send(result);
    });



});

app.post('/createec2',function(req,res){
   createec2();
    setTimeout(function(){
     res.redirect('/ec2list');
},2000);
});

app.post('/ec2destroy',function(req,res){
 destoryec2(req.body.Id);
     res.redirect('/ec2list');
});

app.post('/grabinstanceinfo',function(req,res){
    var id = req.body.id;
    var ec2 = new AWS.EC2({apiVersion: '2016-11-15'});
    var params = {
      InstanceIds: [
        id
        /* more items */
      ]
};
ec2.describeInstances(params, function(err, data) {
  if (err) console.error(err, err.stack); // an error occurred
  else     {
      var info={};
      info[0]= id;
      info[1]=data.Reservations[0].Instances[0].ImageId;
      info[2]=data.Reservations[0].Instances[0].KeyName;
      info[3]=data.Reservations[0].Instances[0].PublicIpAddress;
      info[4]=data.Reservations[0].Instances[0].State.Name;
      res.send(info);

  }
});

});




app.get('/autoscaling',function(req,res){
   res.render('Autoscaling');
});

app.post('/autoscalingsubmit',function(req,res){

    var settings={
        upperbound:req.body.ub,
        lowerbound:req.body.lb,
        expandratio:req.body.ER,
        shrinkratio:req.body.SR
    };
    //console.log(settings);

    connection.query("update settings set ?", settings, function (err, result) {
            if (err) {
                console.error(err);
            }
            else{
                res.redirect('/ec2list');
            }
        })

});

app.post('/destroyS3',function(req,res){
    emptybucket();
    res.redirect('/ec2list');
});

//upload





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

module.exports = app;
