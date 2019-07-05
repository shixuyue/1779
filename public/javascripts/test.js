$(document).ready(function(){
   $('#update').on('click', function () {
    var ub = $('#ub').val();
    var lb = $('#lb').val();
    var ER = $('#ER').val();
    var SR = $('#SR').val();

    if (ub.length ===0 || lb.length ===0 || ER.length ===0|| SR.length ===0){
        alert('You have to assign values for these 4 parameters!');
    }
    else {



            $.ajax({
                url: '/autoscalingsubmit',
                type: 'post',
                data: {
                    ub: ub,
                    lb: lb,
                    ER: ER,
                    SR: SR
                },
                success: function (data) {
                    window.location.href = '/';
                }
            })


        }
    })

});