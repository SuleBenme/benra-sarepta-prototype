from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "service": "sarepta-prototype"})

@api_view(["GET"])
def demo_content(request):
    return Response({
        "title": "Eksempelinnhold",
        "pages": [
            {"title": "Hei", "text": "Dette er eksempeldata fra Django-API-et."}
        ]
    })
