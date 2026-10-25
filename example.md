Example of OpenAI style request and response.

```
curl -v {S1_BASE_URL}/chat/completions \
  -H "Authorization: Bearer {S1_API_KEY}" -H "Content-Type: application/json" \
  -d '{
    "model": "cloudflare/clef-flash",
    "messages": [{"role":"user","content":"{\"ball\":{\"x\":312,\"y\":140,\"vx\":3,\"vy\":4},\"paddle_x\":200,\"width\":480}"}],
    "response_format": {"type":"questions","questions":{
      "zone":{"type":"choice","instructions":"Where will the ball cross the paddle row?",
              "criteria":{"z0":"x 0-60","z1":"x 60-120","z2":"x 120-180","z3":"x 180-240","z4":"x 240-300","z5":"x 300-360","z6":"x 360-420","z7":"x 420-480"}}}}
  }'
```
