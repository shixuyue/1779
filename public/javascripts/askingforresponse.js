$(document).ready(function(){

    var url = window.location.href;
    var sec = url.split('=');
    var instanceid = sec[1];
    console.log(instanceid);
    $.ajax({
        url: '/grabcpu',
        type: 'POST',
        data: {id: instanceid},
        success: function (data) {
            var points = [];
            for(var i=0;i<data.time.length;i++){
                points[i]={y: data.average[i]};
            }
            var options = {
                exportEnabled: true,
                animationEnabled: false,
                title: {
                    text: "CPU"
                },
                data: [
                    {
                        type: "line", //change it to line, area, bar, pie, etc
                        dataPoints: points
                    }]
                };
            console.log(points);
            $("#cpu_plot").CanvasJSChart(options);

         }
        });


    $.ajax({
        url: '/grabNI',
        type: 'POST',
        data: {id: instanceid},
        success: function (data) {
            var points = [];
            for(var i=0;i<data.time.length;i++){
                points[i]={y: data.average[i]};
            }
            var options = {
                exportEnabled: true,
                animationEnabled: false,
                title: {
                    text: "NetworkIn"
                },
                data: [
                    {
                        type: "line", //change it to line, area, bar, pie, etc
                        dataPoints: points
                    }]
                };
            console.log(points);
            $("#net_in_plot").CanvasJSChart(options);

         }
        });

    $.ajax({
        url: '/grabNO',
        type: 'POST',
        data: {id: instanceid},
        success: function (data) {
            var points = [];
            for(var i=0;i<data.time.length;i++){
                points[i]={y: data.average[i]};
            }
            var options = {
                exportEnabled: true,
                animationEnabled: false,
                title: {
                    text: "NetworkOut"
                },
                data: [
                    {
                        type: "line", //change it to line, area, bar, pie, etc
                        dataPoints: points
                    }]
                };
            $("#net_out_plot").CanvasJSChart(options);

         }
        });

    $.ajax({
        url: '/grabinstanceinfo',
        type:'POST',
        data:{id: instanceid},
        success: function(data){
            $("td:contains('aa')").html(data[0]);
            $("td:contains('bb')").html(data[1]);
            $("td:contains('cc')").html(data[2]);
            $("td:contains('dd')").html(data[3]);
            $("td:contains('ee')").html(data[4]);

        }

    });


//$("td:contains('c')").html("new");

    });


