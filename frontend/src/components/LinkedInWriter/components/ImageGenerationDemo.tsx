import React from "react";
import { ImageGenerationSuggestions } from "./index";

const ImageGenerationDemo: React.FC = () => {
  // Sample LinkedIn content for demonstration
  const sampleContent = {
    contentType: "post" as const,
    topic: "AI in Marketing",
    industry: "Technology",
    content: `🚀 Exciting news! Artificial Intelligence is revolutionizing how we approach marketing strategies. 

Here are 3 game-changing ways AI is transforming the industry:

1️⃣ **Predictive Analytics**: AI algorithms can now predict customer behavior with 95% accuracy, allowing marketers to create hyper-personalized campaigns.

2️⃣ **Content Optimization**: Machine learning models analyze engagement patterns to optimize content timing, format, and messaging for maximum impact.

3️⃣ **Automated Personalization**: AI-powered tools automatically adjust marketing messages based on individual user preferences and behavior.

The future of marketing is here, and it's powered by AI! 🎯

What's your experience with AI in marketing? Share your thoughts below! 👇

#AIMarketing #DigitalTransformation #MarketingInnovation #TechTrends #FutureOfMarketing`,
  };

  const handleImageGenerated = (imageData: any) => {
    console.log("Image generated successfully:", imageData);
    // Here you would typically:
    // 1. Update the LinkedIn preview editor
    // 2. Store the image in your content
    // 3. Trigger any follow-up actions
  };

  return (
    <div className="image-generation-demo">
      <div className="demo-header">
        <h1 className="demo-title">LinkedIn Image Generation Demo</h1>
        <p className="demo-description">
          This demo showcases the ImageGenerationSuggestions component
          integrated with CopilotKit. Try generating image prompts and creating
          images for the sample LinkedIn content below.
        </p>
      </div>

      <div className="demo-content">
        <div className="content-preview">
          <h2 className="content-title">Sample LinkedIn Content</h2>
          <div className="content-display">
            <div className="content-header">
              <span className="content-type-badge">
                {sampleContent.contentType}
              </span>
              <span className="content-topic">{sampleContent.topic}</span>
              <span className="content-industry">{sampleContent.industry}</span>
            </div>
            <div className="content-text">{sampleContent.content}</div>
          </div>
        </div>

        <div className="image-generation-section">
          <h2 className="section-title">Image Generation</h2>
          <ImageGenerationSuggestions
            contentType={sampleContent.contentType}
            topic={sampleContent.topic}
            industry={sampleContent.industry}
            content={sampleContent.content}
            onImageGenerated={handleImageGenerated}
            className="demo-image-suggestions"
          />
        </div>
      </div>

      <div className="demo-footer">
        <h3 className="footer-title">How It Works</h3>
        <div className="workflow-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Content Analysis</h4>
              <p>
                The system analyzes your LinkedIn content to understand context,
                tone, and target audience.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Prompt Generation</h4>
              <p>
                AI generates three distinct image prompts: Professional,
                Creative, and Industry-Specific.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Image Creation</h4>
              <p>
                Using Gemini API, creates LinkedIn-optimized images from your
                selected prompt.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>Integration</h4>
              <p>
                Generated images are ready to use in your LinkedIn content
                editor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerationDemo;
