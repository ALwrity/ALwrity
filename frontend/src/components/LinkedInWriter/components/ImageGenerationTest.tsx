import React from "react";
import { ImageGenerationSuggestions } from "./index";

const ImageGenerationTest: React.FC = () => {
  const handleImageGenerated = (imageData: any) => {
    console.log("Image generated successfully:", imageData);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Image Generation Test</h1>
      <p>Testing the ImageGenerationSuggestions component...</p>

      <div
        style={{
          background: "#f8f9fa",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "20px",
          border: "1px solid #e9ecef",
        }}
      >
        <h3>🎯 How It Works Now:</h3>
        <ol>
          <li>
            <strong>Generate LinkedIn Content:</strong> Use Copilot to generate
            a post, article, or carousel
          </li>
          <li>
            <strong>See Image Suggestions:</strong> After content generation,
            Copilot will automatically suggest image generation
          </li>
          <li>
            <strong>Ask for Images:</strong> Type "Generate images for my
            LinkedIn post" or similar
          </li>
          <li>
            <strong>Choose Style:</strong> Select from Professional, Creative,
            or Industry-Specific styles
          </li>
        </ol>

        <div
          style={{
            background: "#e3f2fd",
            padding: "15px",
            borderRadius: "6px",
            marginTop: "15px",
            border: "1px solid #2196f3",
          }}
        >
          <strong>💡 Pro Tip:</strong> The image generation suggestions now
          appear automatically after every successful content generation in the
          Copilot chat!
        </div>
      </div>

      <ImageGenerationSuggestions
        contentType="post"
        topic="AI in Marketing"
        industry="Technology"
        content="This is a test LinkedIn post about AI in marketing. It demonstrates the image generation capabilities."
        onImageGenerated={handleImageGenerated}
      />
    </div>
  );
};

export default ImageGenerationTest;
