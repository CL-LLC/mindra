import os
from io import BytesIO

import modal
from fastapi import Response

MODEL_NAME = os.environ.get('FLUX_MODEL_NAME', 'black-forest-labs/FLUX.2-klein')
CACHE_DIR = '/cache'
volume = modal.Volume.from_name('mindra-flux-cache', create_if_missing=True)

app = modal.App(os.environ.get('MODAL_APP_NAME', 'mindra-flux'))
image = (
    modal.Image.debian_slim(python_version='3.11')
    .pip_install(
        'fastapi',
        'pillow',
        'diffusers==0.33.1',
        'transformers>=4.48.0',
        'accelerate>=1.1.0',
        'safetensors>=0.4.5',
        'sentencepiece',
        'huggingface_hub>=0.26.0',
        'torch',
    )
)


@app.cls(image=image, gpu='A10G', timeout=300, volumes={CACHE_DIR: volume})
class FluxImageGenerator:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import FluxPipeline

        self.torch = torch
        self.pipe = FluxPipeline.from_pretrained(
            MODEL_NAME,
            torch_dtype=torch.bfloat16,
            cache_dir=CACHE_DIR,
        )
        self.pipe.to('cuda')

    @modal.web_endpoint(method='POST')
    def generate(self, req: dict):
        token_secret = os.environ.get('MODAL_TOKEN_SECRET', '')
        auth = req.get('_auth', '') or req.get('authorization', '') or req.get('Authorization', '')
        if token_secret and auth != f'Bearer {token_secret}':
            return Response(content='{"error":"Unauthorized"}', status_code=401, media_type='application/json')

        prompt = (req.get('prompt') or '').strip()
        if not prompt:
            return Response(content='{"error":"Missing prompt"}', status_code=400, media_type='application/json')

        width = max(64, min(int(req.get('width', 1024)), 1080))
        height = max(64, min(int(req.get('height', 1024)), 1080))
        seed = req.get('seed')

        generator = None
        if seed is not None:
            generator = self.torch.Generator(device='cuda').manual_seed(int(seed))

        result = self.pipe(
            prompt=prompt,
            width=width,
            height=height,
            guidance_scale=3.5,
            num_inference_steps=28,
            generator=generator,
        )

        image = result.images[0].convert('RGB')
        buf = BytesIO()
        image.save(buf, format='PNG')
        return Response(content=buf.getvalue(), media_type='image/png', headers={'x-model': 'FLUX.2 klein 4B'})
