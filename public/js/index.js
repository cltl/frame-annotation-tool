$(function(){
    $('#btnLogin').click(function(e) {
        e.preventDefault();
        logMeIn();
    });
});

var logMeIn = function(){
    var uname = $("#uname").val();
    var pass = $('#pass').val();
    if (uname!="" && pass!=""){
        var url = "/login?username=" + encodeURIComponent(uname) + "&password=" + encodeURIComponent($('#pass').val());
        $.post(url, function( data, status ) {
            if (data!="OK"){
                $("#output").removeClass(' alert alert-success');
                $("#output").addClass("alert alert-danger animated fadeInUp").html("Login information incorrect!");
            } else {
                window.location.href = "/dash";
            }
    });
    } else{
        $("#output").removeClass(' alert alert-success');
        $("#output").addClass("alert alert-danger animated fadeInUp").html("Empty username or password!");
    }
}

var logout = function(){
    $.get("/logout");
}
