# Stability AI Integration - Quick Start Guide

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure API Key
```bash
# Copy example environment file
cp .env.stability.example .env

# Edit .env and add your Stability AI API key
STABILITY_API_KEY=your_api_key_here
```

### 3. Start the Server
```bash
python app.py
```

### 4. Test the Integration
```bash
# Run basic tests
python test_stability_basic.py

# Initialize and test service
python scripts/init_stability_service.py
```

## 🎯 Quick API Reference

### Generate Images

**Text-to-Image (Ultra Quality)**
```bash
curl -X POST "http://localhost:8000/api/stability/generate/ultra" \
     -F "prompt=A majestic mountain landscape at sunset" \
     -F "aspect_ratio=16:9" \
     -F "style_preset=photographic" \
     -o generated_image.png
```

**Text-to-Image (Fast & Affordable)**
```bash
curl -X POST "http://localhost:8000/api/stability/generate/core" \
     -F "prompt=A cute cat in a garden" \
     -F "aspect_ratio=1:1" \
     -o cat_image.png
```

**SD3.5 Generation**
```bash
curl -X POST "http://localhost:8000/api/stability/generate/sd3" \
     -F "prompt=A futuristic cityscape" \
     -F "model=sd3.5-large" \
     -F "aspect_ratio=21:9" \
     -o city_image.png
```

### Edit Images

**Remove Background**
```bash
curl -X POST "http://localhost:8000/api/stability/edit/remove-background" \
     -F "image=@input.png" \
     -o no_background.png
```

**Inpaint (Fill Areas)**
```bash
curl -X POST "http://localhost:8000/api/stability/edit/inpaint" \
     -F "image=@input.png" \
     -F "mask=@mask.png" \
     -F "prompt=a beautiful garden" \
     -o inpainted.png
```

**Search and Replace**
```bash
curl -X POST "http://localhost:8000/api/stability/edit/search-and-replace" \
     -F "image=@dog_image.png" \
     -F "prompt=golden retriever" \
     -F "search_prompt=dog" \
     -o golden_retriever.png
```

**Outpaint (Expand Image)**
```bash
curl -X POST "http://localhost:8000/api/stability/edit/outpaint" \
     -F "image=@input.png" \
     -F "left=200" \
     -F "right=200" \
     -F "prompt=continue the scene" \
     -o expanded.png
```

### Upscale Images

**Fast 4x Upscale**
```bash
curl -X POST "http://localhost:8000/api/stability/upscale/fast" \
     -F "image=@low_res.png" \
     -o upscaled_4x.png
```

**Conservative 4K Upscale**
```bash
curl -X POST "http://localhost:8000/api/stability/upscale/conservative" \
     -F "image=@input.png" \
     -F "prompt=high quality detailed image" \
     -o upscaled_4k.png
```

### Control Generation

**Sketch to Image**
```bash
curl -X POST "http://localhost:8000/api/stability/control/sketch" \
     -F "image=@sketch.png" \
     -F "prompt=a medieval castle on a hill" \
     -F "control_strength=0.8" \
     -o castle_image.png
```

**Style Transfer**
```bash
curl -X POST "http://localhost:8000/api/stability/control/style-transfer" \
     -F "init_image=@content.png" \
     -F "style_image=@style_ref.png" \
     -o styled_image.png
```

### Generate 3D Models

**Fast 3D Generation**
```bash
curl -X POST "http://localhost:8000/api/stability/3d/stable-fast-3d" \
     -F "image=@object.png" \
     -o model.glb
```

### Generate Audio

**Text-to-Audio**
```bash
curl -X POST "http://localhost:8000/api/stability/audio/text-to-audio" \
     -F "prompt=Peaceful piano music with rain sounds" \
     -F "duration=60" \
     -F "model=stable-audio-2.5" \
     -o music.mp3
```

**Audio-to-Audio**
```bash
curl -X POST "http://localhost:8000/api/stability/audio/audio-to-audio" \
     -F "prompt=Transform into jazz style" \
     -F "audio=@input.mp3" \
     -F "strength=0.8" \
     -o jazz_version.mp3
```

## 📊 Monitoring & Admin

### Check Service Health
```bash
curl "http://localhost:8000/api/stability/health"
```

### Get Account Balance
```bash
curl "http://localhost:8000/api/stability/user/balance"
```

### View Service Statistics
```bash
curl "http://localhost:8000/api/stability/admin/stats"
```

### Get Model Information
```bash
curl "http://localhost:8000/api/stability/models/info"
```

## 🔧 Utilities

### Analyze Image
```bash
curl -X POST "http://localhost:8000/api/stability/utils/image-info" \
     -F "image=@test.png"
```

### Validate Prompt
```bash
curl -X POST "http://localhost:8000/api/stability/utils/validate-prompt" \
     -F "prompt=A beautiful landscape with mountains"
```

### Compare Models
```bash
curl -X POST "http://localhost:8000/api/stability/advanced/compare/models" \
     -F "prompt=A sunset over the ocean" \
     -F "models=[\"ultra\", \"core\", \"sd3.5-large\"]" \
     -F "seed=42"
```

## 📋 Available Endpoints

### Core Generation (25+ endpoints)
- `/api/stability/generate/ultra` - Highest quality generation
- `/api/stability/generate/core` - Fast and affordable
- `/api/stability/generate/sd3` - SD3.5 model suite
- `/api/stability/edit/erase` - Remove objects
- `/api/stability/edit/inpaint` - Fill/replace areas
- `/api/stability/edit/outpaint` - Expand images
- `/api/stability/edit/search-and-replace` - Replace via prompts
- `/api/stability/edit/search-and-recolor` - Recolor via prompts
- `/api/stability/edit/remove-background` - Background removal
- `/api/stability/upscale/fast` - 4x fast upscaling
- `/api/stability/upscale/conservative` - 4K conservative upscale
- `/api/stability/upscale/creative` - Creative upscaling
- `/api/stability/control/sketch` - Sketch to image
- `/api/stability/control/structure` - Structure-guided generation
- `/api/stability/control/style` - Style-guided generation
- `/api/stability/control/style-transfer` - Style transfer
- `/api/stability/3d/stable-fast-3d` - Fast 3D generation
- `/api/stability/3d/stable-point-aware-3d` - Advanced 3D
- `/api/stability/audio/text-to-audio` - Text to audio
- `/api/stability/audio/audio-to-audio` - Audio transformation
- `/api/stability/audio/inpaint` - Audio inpainting
- `/api/stability/results/{id}` - Async result polling

### Advanced Features
- `/api/stability/advanced/workflow/image-enhancement` - Auto enhancement
- `/api/stability/advanced/workflow/creative-suite` - Multi-step workflows
- `/api/stability/advanced/compare/models` - Model comparison
- `/api/stability/advanced/batch/process-folder` - Batch processing

### Admin & Monitoring
- `/api/stability/admin/stats` - Service statistics
- `/api/stability/admin/health/detailed` - Detailed health check
- `/api/stability/admin/usage/summary` - Usage analytics
- `/api/stability/admin/costs/estimate` - Cost estimation

### Utilities
- `/api/stability/utils/image-info` - Image analysis
- `/api/stability/utils/validate-prompt` - Prompt validation
- `/api/stability/health` - Basic health check
- `/api/stability/models/info` - Model information
- `/api/stability/supported-formats` - Supported formats

## 💡 Pro Tips

### Cost Optimization
- Use **Core** model for drafts and iterations (3 credits)
- Use **Ultra** model for final high-quality outputs (8 credits)
- Use **Fast Upscale** for quick 4x enhancement (2 credits)
- Batch similar operations together

### Quality Tips
- Include style descriptors in prompts ("photographic", "digital art")
- Add quality terms ("high quality", "detailed", "sharp")
- Use negative prompts to avoid unwanted elements
- Optimize image dimensions before upload

### Performance Tips
- Enable caching for repeated operations
- Use appropriate models for your speed/quality needs
- Monitor rate limits (150 requests/10 seconds)
- Process large batches using batch endpoints

## 🔗 Useful Links

- **API Documentation**: http://localhost:8000/docs
- **Stability AI Platform**: https://platform.stability.ai
- **Get API Key**: https://platform.stability.ai/account/keys
- **Integration Guide**: `backend/docs/STABILITY_AI_INTEGRATION.md`
- **Test Suite**: none at the moment (the old `backend/test/test_stability_endpoints.py` was removed)

## 🆘 Quick Troubleshooting

**"API key missing"** → Set `STABILITY_API_KEY` in `.env` file  
**"Rate limit exceeded"** → Wait 60 seconds or implement request queuing  
**"File too large"** → Compress images under 10MB  
**"Invalid dimensions"** → Check image size requirements for operation  
**"Network error"** → Verify internet connection to api.stability.ai  

---

**🎉 You're all set! The complete Stability AI integration is ready to use.**