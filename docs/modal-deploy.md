# Modal FLUX.2 klein 4B deploy

1. Set env vars:
   - `MODAL_TOKEN_ID`
   - `MODAL_TOKEN_SECRET`
   - `MODAL_APP_NAME=mindra-flux`

2. Deploy:
   ```bash
   modal deploy modal/flux-image.py
   ```

3. Copy the deployed web endpoint into:
   - `MODAL_FLUX_ENDPOINT_URL`

4. Run Mindra with `MODAL_FLUX_ENDPOINT_URL` configured. Video scene image generation now always uses the Modal FLUX endpoint and intentionally does not fall back to OpenAI image models.

Notes:
- Output is clamped to 1080p max.
- The Modal app uses a shared volume cache at `/cache`.
- The endpoint accepts `prompt`, optional `seed`, `width`, `height` and returns PNG bytes.
