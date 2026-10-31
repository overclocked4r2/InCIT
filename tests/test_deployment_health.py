from app.main import app, deployment_health


def test_root_health_check_is_available_for_deployment_platforms():
    routes = {route.path for route in app.routes}

    assert "/health" in routes
    assert deployment_health()["status"] == "ok"
