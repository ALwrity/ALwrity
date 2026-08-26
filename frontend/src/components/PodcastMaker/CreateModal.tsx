import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Stack, Paper, Box, Chip, Typography, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { CreateProjectPayload, Knobs, PodcastMode } from "./types";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { podcastApi } from "../../services/podcastApi";
import { fetchMediaBlobUrl, clearMediaCache } from "../../utils/fetchMediaBlobUrl";
import { getLatestBrandAvatar } from "../../api/brandAssets";
import { VoiceSelector, VOICE_CLONE_ID } from "../shared/VoiceSelector";
import { getLatestVoiceClone } from "../../api/brandAssets";
import { setCachedVoiceCloneInfo } from "../../services/podcastApi";

// Imported Components
import { TopicUrlInput, TOPIC_PLACEHOLDERS } from "./CreateStep/TopicUrlInput";
import { PodcastConfiguration } from "./CreateStep/PodcastConfiguration";
import { AvatarSelector } from "./CreateStep/AvatarSelector";
import { CreateActions } from "./CreateStep/CreateActions";
import { EnhancedTopicChoicesModal } from "./EnhancedTopicChoicesModal";
import { TrendingTopicsModal } from "./CreateStep/TrendingTopicsModal";
import { CategoryResearchModal } from "./CreateStep/CategoryResearchModal";

const ENHANCE_TOPIC_PROGRESS_MESSAGES = [
  "Analyzing your topic idea...",
  "Enhancing clarity and hook...",
  "Aligning language for podcast listeners...",
];

// Dynamic progress messages based on context
const getEnhanceProgressMessage = (index: number, hasWebsite: boolean, hasTopicContext: boolean): string => {
  const messagesWithAll = [
    "Analyzing your topic with website and category research...",
    "Incorporating website insights and research findings...",
    "Generating podcast angles based on all available context...",
    "Creating personalized episode concepts...",
    "Finalizing enhanced pitch options...",
  ];
  
  const messagesWithWebsite = [
    "Analyzing your topic with website content...",
    "Incorporating website insights and company details...",
    "Generating podcast angles based on your website analysis...",
    "Creating personalized episode concepts...",
    "Finalizing enhanced pitch options...",
  ];
  
  const messagesWithTopic = [
    "Analyzing your topic with category research...",
    "Incorporating research insights and trends...",
    "Generating podcast angles based on your research...",
    "Creating personalized episode concepts...",
    "Finalizing enhanced pitch options...",
  ];
  
  const messagesBasic = [
    "Analyzing your topic idea...",
    "Enhancing clarity and hook...",
    "Aligning language for podcast listeners...",
    "Crafting compelling angles...",
    "Finalizing recommendations...",
  ];
  
  let messages;
  if (hasWebsite && hasTopicContext) {
    messages = messagesWithAll;
  } else if (hasWebsite) {
    messages = messagesWithWebsite;
  } else if (hasTopicContext) {
    messages = messagesWithTopic;
  } else {
    messages = messagesBasic;
  }
  return messages[index % messages.length];
};

interface CreateModalProps {
  onCreate: (payload: CreateProjectPayload) => void;
  open: boolean;
  defaultKnobs: Knobs;
  isSubmitting?: boolean;
  announcement?: string;
  onAnnouncementClear?: () => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({ onCreate, open, defaultKnobs, isSubmitting = false, announcement, onAnnouncementClear }) => {
  const { subscription } = useSubscription();
  const [topicInput, setTopicInput] = useState("");
  const [showAIDetailsButton, setShowAIDetailsButton] = useState(false);
  const [speakers, setSpeakers] = useState<number>(1);
  const [duration, setDuration] = useState<number>(1);
  const [budgetCap, setBudgetCap] = useState<number>(50);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreviewBlobUrl, setAvatarPreviewBlobUrl] = useState<string | null>(null);
  const [makingPresentable, setMakingPresentable] = useState(false);
  const [enhancingTopic, setEnhancingTopic] = useState(false);
  const [enhanceTopicProgressIndex, setEnhanceTopicProgressIndex] = useState(0);
  const [knobs, setKnobs] = useState<Knobs>({ ...defaultKnobs });
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("Wise_Woman");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [avatarTab, setAvatarTab] = useState(0);
  const [loadingBrandAvatar, setLoadingBrandAvatar] = useState(false);
  const [brandAvatarFromDb, setBrandAvatarFromDb] = useState<string | null>(null);
  const [cameraSelfieOpen, setCameraSelfieOpen] = useState(false);
  const [podcastMode, setPodcastMode] = useState<PodcastMode>("audio_video");
  
  // Enhanced topic choices state
  const [enhancedChoices, setEnhancedChoices] = useState<string[]>([]);
  const [enhancedRationales, setEnhancedRationales] = useState<string[]>([]);
  const [choicesModalOpen, setChoicesModalOpen] = useState(false);
  const [editedChoices, setEditedChoices] = useState<string[]>([]);
  
  // Website extraction data for AI enhance
  const [websiteData, setWebsiteData] = useState<{
    title?: string;
    text?: string;
    summary?: string;
    highlights?: string[];
    url: string;
    subpages?: Array<{id?: string; title?: string; url?: string; summary?: string; text?: string}>;
  } | null>(null);

  // Category research context for AI enhance
  const [topicContext, setTopicContext] = useState<{
    category: string;
    topics: Array<{title: string; url: string; snippet: string; score: number}>;
    selected_topic: {title: string; url: string; snippet: string};
  } | null>(null);

  // Enhance topic progress modal state
  const [showEnhanceProgressModal, setShowEnhanceProgressModal] = useState(false);

  // Trending topics state
  const [trendingModalOpen, setTrendingModalOpen] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // Category research state
  const [categoryResearchOpen, setCategoryResearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<"news" | "finance" | "research-paper" | "personal-site">("news");
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryTopics, setCategoryTopics] = useState<Array<{
    title: string;
    url: string;
    snippet: string;
    score: number;
    favicon?: string;
  }>>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryCached, setCategoryCached] = useState(false);
  const [lastSearchedTopic, setLastSearchedTopic] = useState<string>("");
  const [lastSearchedCategory, setLastSearchedCategory] = useState<"news" | "finance" | "research-paper" | "personal-site">("news");

// Rotate placeholder every 3 seconds
useEffect(() => {
  if (!topicInput) {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % TOPIC_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }
}, [topicInput]);

// Cost estimate state - compatible with TopicUrlInput props
type EstimateType = number | { analysisCost: number; researchCost: number; scriptCost: number; ttsCost: number; voiceCloneCost: number; avatarCost: number; videoCost: number; total: number; } | null;
const [estimatedCost, setEstimatedCost] = useState<EstimateType>(null);
const [costEstimateLoading, setCostEstimateLoading] = useState(false);

// Fetch cost estimate when config changes
useEffect(() => {
  const fetchEstimate = async () => {
    if (!duration || !speakers || !podcastMode) return;
    
    setCostEstimateLoading(true);
    try {
      const result = await podcastApi.preEstimateCost({
        duration,
        speakers,
        queryCount: 3, // Default to 3 queries
        podcastMode,
      });
      
      console.log('[Cost Estimate] Response:', result);
      console.log('[Cost Estimate] Total:', result.estimate?.total);
      console.log('[Cost Estimate] Full breakdown:', result.estimate);
      
      if (result.estimate?.total !== undefined) {
        // Store full estimate object for tooltip
        setEstimatedCost(result.estimate);
      } else {
        setEstimatedCost(null);
      }
    } catch (error) {
      console.error("Cost estimate error:", error);
      setEstimatedCost(null);
    } finally {
      setCostEstimateLoading(false);
    }
  };
  
  fetchEstimate();
}, [duration, speakers, podcastMode]);

  // Fetch Brand Avatar on mount but don't select it
  useEffect(() => {
    const fetchBrandAvatar = async () => {
      try {
        setLoadingBrandAvatar(true);
        const result = await getLatestBrandAvatar();
        if (result.success && result.image_url) {
          setBrandAvatarFromDb(result.image_url);
        }
      } catch (error) {
        console.error("Failed to pre-fetch brand avatar:", error);
      } finally {
        setLoadingBrandAvatar(false);
      }
    };
    fetchBrandAvatar();
  }, []);

  // Load saved website extraction on mount
  useEffect(() => {
    const loadSavedWebsiteExtraction = async () => {
      try {
        const result = await podcastApi.getWebsiteExtraction();
        if (result.success && result.data) {
          setWebsiteData({
            title: result.data.title,
            text: result.data.text,
            summary: result.data.summary,
            highlights: result.data.highlights,
            url: result.data.url,
            subpages: result.data.subpages,
          });
        }
      } catch (error) {
        console.warn("Failed to load saved website extraction:", error);
      }
    };
    loadSavedWebsiteExtraction();
  }, []);

  useEffect(() => {
    if (!avatarPreview) {
      setAvatarPreviewBlobUrl(null);
      return;
    }

    if (avatarPreview.startsWith("data:") || avatarPreview.startsWith("blob:")) {
      setAvatarPreviewBlobUrl(null);
      return;
    }

    const isInternal =
      avatarPreview.includes("/api/podcast/") ||
      avatarPreview.includes("/api/youtube/") ||
      avatarPreview.includes("/api/story/") ||
      (avatarPreview.startsWith("/") && !avatarPreview.startsWith("//"));

    if (!isInternal) {
      setAvatarPreviewBlobUrl(null);
      return;
    }

    let isMounted = true;
    const currentPreview = avatarPreview;

    const loadBlob = async () => {
      try {
        const blobUrl = await fetchMediaBlobUrl(currentPreview);

        if (!isMounted || avatarPreview !== currentPreview) {
          if (blobUrl && blobUrl.startsWith("blob:")) {
            URL.revokeObjectURL(blobUrl);
          }
          return;
        }

        setAvatarPreviewBlobUrl((prev) => {
          if (prev && prev !== blobUrl && prev.startsWith("blob:")) {
            URL.revokeObjectURL(prev);
          }
          return blobUrl;
        });
      } catch {
        if (isMounted && avatarPreview === currentPreview) {
          setAvatarPreviewBlobUrl(null);
        }
      }
    };

    loadBlob();

    return () => {
      isMounted = false;
      setAvatarPreviewBlobUrl((prev) => {
        if (prev && prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
    };
  }, [avatarPreview]);

  // Handle blob URL for the potential brand avatar preview (not selected yet)
  const [brandAvatarBlobUrl, setBrandAvatarBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!brandAvatarFromDb) {
      setBrandAvatarBlobUrl(null);
      return;
    }
    
    let isMounted = true;
    const loadBrandBlob = async () => {
      try {
        // Clear cache for this URL to ensure fresh data
        if (brandAvatarFromDb) {
          clearMediaCache(brandAvatarFromDb);
        }
        
        const blobUrl = await fetchMediaBlobUrl(brandAvatarFromDb);
        if (isMounted) setBrandAvatarBlobUrl(blobUrl);
      } catch (err) {
        console.error("Failed to load brand avatar blob:", err);
      }
    };
    loadBrandBlob();
    return () => {
      isMounted = false;
      if (brandAvatarBlobUrl && brandAvatarBlobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(brandAvatarBlobUrl);
      }
    };
  }, [brandAvatarFromDb]);

  // Ensure duration and speakers are within limits
  useEffect(() => {
    if (duration > 10) {
      setDuration(10);
    }
    if (speakers > 2) {
      setSpeakers(2);
    }
  }, [duration, speakers]);

  // URL detection helper
  const detectUrl = (text: string): boolean => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(text);
  };

  const isUrl = useMemo(() => detectUrl(topicInput), [topicInput]);
  const enhanceTopicMessage = enhancingTopic ? getEnhanceProgressMessage(enhanceTopicProgressIndex, !!websiteData, !!topicContext) : undefined;

  useEffect(() => {
    if (!enhancingTopic) {
      setEnhanceTopicProgressIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setEnhanceTopicProgressIndex((prev) => {
        const maxMessages = (websiteData || topicContext) ? 5 : 3;
        return (prev + 1) % maxMessages;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [enhancingTopic, websiteData, topicContext]);

  // Handle AI Details button click
  const handleAIDetailsClick = async () => {
    if (!topicInput.trim() || enhancingTopic) return;
    
    // Show progress modal
    setShowEnhanceProgressModal(true);
    
    try {
      setEnhancingTopic(true);
      
      // Build website data (excluding images/favicon)
      const websiteDataForApi = websiteData ? {
        title: websiteData.title,
        text: websiteData.text,
        summary: websiteData.summary,
        highlights: websiteData.highlights,
        url: websiteData.url,
        subpages: websiteData.subpages,
      } : undefined;
      
      const result = await podcastApi.enhanceIdea({
        idea: topicInput,
        website_data: websiteDataForApi,
        topic_context: topicContext || undefined,
      });
      
      if (result.enhanced_ideas && result.enhanced_ideas.length === 3) {
        setEnhancedChoices(result.enhanced_ideas);
        setEnhancedRationales(result.rationales || []);
        setEditedChoices(result.enhanced_ideas); // Initialize editable versions
        setChoicesModalOpen(true);
      }
    } catch (error) {
      console.error("Failed to enhance idea with AI:", error);
    } finally {
      setEnhancingTopic(false);
      setShowEnhanceProgressModal(false);
    }
  };

  // Handle Category Research (News/Finance/Research Papers/Personal Website) click
  const handleCategoryResearchClick = async (category: "news" | "finance" | "research-paper" | "personal-site", websiteUrl?: string, forceRefresh: boolean = false, overrideKeyword?: string) => {
    const currentTopic = (overrideKeyword || topicInput.trim());
    
    // Check if we have cached results for the same topic + category combination (only if not force refresh)
    if (!forceRefresh && !overrideKeyword && currentTopic === lastSearchedTopic && category === lastSearchedCategory && categoryTopics.length > 0) {
      setSelectedCategory(category);
      setCategoryResearchOpen(true);
      setCategoryCached(true);
      setCategoryLoading(false);
      return;
    }

    setSelectedCategory(category);
    setCategoryResearchOpen(true);
    setCategoryLoading(true);
    setCategoryError(null);
    setCategoryCached(false);
    setCategoryTopics([]);

    // For personal-site, check if topic input looks like a URL
    let websiteUrlToUse: string | undefined;
    if (category === "personal-site" && topicInput.trim()) {
      const topicText = topicInput.trim();
      // Check if it looks like a URL
      if (topicText.startsWith('http://') || topicText.startsWith('https://') || topicText.includes('://') || (topicText.includes('.') && !topicText.includes(' '))) {
        websiteUrlToUse = topicText;
      }
    }

    try {
      const result = await podcastApi.researchByCategory({
        category,
        keyword: currentTopic || undefined,
        maxResults: 8,
        websiteUrl: websiteUrlToUse,
      });

      if (result.success) {
        setCategoryTopics(result.topics || []);
        setLastSearchedTopic(currentTopic);
        setLastSearchedCategory(category);
      } else {
        setCategoryError(result.error || `Failed to fetch ${category} topics`);
      }
    } catch (error: any) {
      setCategoryError(error?.message || `Failed to fetch ${category} topics`);
    } finally {
      setCategoryLoading(false);
    }
  };

  // Handle Redo Search for category research
  const handleCategoryRedoSearch = (keyword: string, websiteUrl?: string) => {
    handleCategoryResearchClick(selectedCategory, websiteUrl, true, keyword);
  };

  // Handle enhanced topic choice selection
  const handleChoiceSelection = (selectedIndex: number, editedChoice: string) => {
    const selectedTopic = editedChoice;
    setTopicInput(selectedTopic);
    setChoicesModalOpen(false);
    // Reset choices state
    setEnhancedChoices([]);
    setEnhancedRationales([]);
    setEditedChoices([]);
  };

  // Show AI details button when user starts typing (and it's not a URL)
  useEffect(() => {
    setShowAIDetailsButton(topicInput.trim().length > 0 && !isUrl);
  }, [topicInput, isUrl]);

  // Check if avatar is present (from any source: upload, selfie, brand avatar, or asset library)
  const hasAvatar = Boolean(
    avatarFile ||                         // User uploaded an image
    avatarUrl ||                         // Already processed avatar URL
    avatarPreview ||                      // Avatar preview available
    brandAvatarFromDb ||                  // Brand avatar from database
    brandAvatarBlobUrl                    // Brand avatar blob URL
  );

  // Check if all required inputs are provided
  const hasTopic = Boolean(topicInput.trim());
  const hasVoice = Boolean(selectedVoiceId);
  const hasDuration = Boolean(duration > 0 && duration <= 10);
  const hasSpeakers = Boolean(speakers >= 1 && speakers <= 2);
  const hasPodcastMode = Boolean(podcastMode);

  // Required: topic, duration, speakers, voice, podcastMode, presenter avatar
  // Avatar required for video modes; for audio_only, still require avatar for presenter display
  const canSubmit = Boolean(hasTopic && hasVoice && hasDuration && hasSpeakers && hasPodcastMode && hasAvatar);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return;
    
    setSubmitError(null);
    
    // Determine if input is idea or URL
    // For URL, we extract the first URL found or use the whole string if it's a direct URL
    let finalIdea = "";

    if (isUrl) {
      // Extract the URL from the input
      const urlMatch = topicInput.match(/(https?:\/\/[^\s]+)/);
      const detectedUrl = urlMatch ? urlMatch[0] : topicInput;
      
      // Extract content from the URL using Exa
      try {
        setEnhancingTopic(true);
        setEnhanceTopicProgressIndex(0);
        
        const { podcastApi } = await import("../../services/podcastApi");
        const extractResult = await podcastApi.extractUrl({ url: detectedUrl });
        
        if (extractResult.success && extractResult.summary) {
          // Use extracted content as the podcast topic
          finalIdea = extractResult.summary;
          if (extractResult.title) {
            finalIdea = `${extractResult.title}: ${finalIdea}`;
          }
        } else if (extractResult.success && extractResult.text) {
          // Fallback to text if no summary
          finalIdea = extractResult.text.substring(0, 500);
        } else {
          // Fallback: use the URL itself if extraction fails
          finalIdea = detectedUrl;
          console.warn("[CreateModal] URL extraction failed:", extractResult.error);
        }
      } catch (error) {
        console.error("[CreateModal] URL extraction error:", error);
        finalIdea = detectedUrl; // Fallback to URL
      } finally {
        setEnhancingTopic(false);
      }
    } else {
      finalIdea = topicInput;
    }
    
    // If avatar was uploaded but not yet uploaded to server, upload it now
    let finalAvatarUrl: string | null = avatarUrl;
    if (avatarFile && !avatarUrl) {
      try {
        const { podcastApi } = await import("../../services/podcastApi");
        const uploadResult = await podcastApi.uploadAvatar(avatarFile);
        finalAvatarUrl = uploadResult.avatar_url;
      } catch (error) {
        console.error('Avatar upload failed:', error);
        // Continue without avatar
      }
    }
    
    // Include selected voice in knobs
    // If voice clone is selected, include voice clone metadata
    // VoiceSelector may pass VOICE_CLONE_ID, the actual clone ID (vc_*), or a system voice ID
    const selectedLooksLikeClone = selectedVoiceId?.startsWith("vc_") || selectedVoiceId === "MY_VOICE_CLONE";
    const isVoiceClone = selectedVoiceId === VOICE_CLONE_ID || selectedLooksLikeClone || knobs.custom_voice_id === selectedVoiceId;
    
    let voiceSampleUrl: string | undefined;
    let voiceCloneEngine: string | undefined;
    let customVoiceId: string | undefined;
    
    if (isVoiceClone) {
      // If VoiceSelector already gave us the real clone ID, use it as fallback
      if (selectedLooksLikeClone && selectedVoiceId !== VOICE_CLONE_ID) {
        customVoiceId = selectedVoiceId;
      }
      try {
        const voiceCloneInfo = await getLatestVoiceClone();
        if (voiceCloneInfo?.success && voiceCloneInfo.custom_voice_id) {
          customVoiceId = voiceCloneInfo.custom_voice_id;
          voiceSampleUrl = voiceCloneInfo.preview_audio_url;
          voiceCloneEngine = voiceCloneInfo.engine || "qwen3";
          // Cache for reuse across scenes
          setCachedVoiceCloneInfo({
            customVoiceId,
            voiceSampleUrl,
            engine: voiceCloneEngine,
            isVoiceClone: true,
          });
        }
      } catch (e) {
        console.warn("[CreateModal] Could not fetch voice clone info:", e);
      }
    } else {
      // Clear cache if system voice selected
      setCachedVoiceCloneInfo({ isVoiceClone: false });
    }
    
    const finalKnobs: Knobs = {
      ...knobs,
      // When a voice clone is active, use the real clone ID (e.g. "vc_abc123") so that
      // downstream consumers (toPodcastEstimate, ScriptEditorLayout, AnalysisPanel) can
      // correctly identify it as a custom voice and display "My Voice Clone".
      // The actual TTS rendering always reads custom_voice_id — voice_id is used only for
      // display-name resolution and the "is custom voice?" guard in toPodcastEstimate.
      voice_id: isVoiceClone ? (customVoiceId || selectedVoiceId) : selectedVoiceId,
      custom_voice_id: customVoiceId,
      is_voice_clone: isVoiceClone,
      voice_sample_url: voiceSampleUrl,
      voice_clone_engine: voiceCloneEngine,
    };
    
    try {
      await onCreate({
        ideaOrUrl: finalIdea,
        speakers,
        duration,
        knobs: finalKnobs,
        budgetCap,
        files: { voiceFile, avatarFile },
        avatarUrl: finalAvatarUrl,
        podcastMode,
      });
    } catch (err: any) {
      console.error("[CreateModal] Submit error:", err);
      setSubmitError(err?.message || String(err) || "Failed to create project");
    }
  }, [canSubmit, isSubmitting, isUrl, topicInput, avatarFile, avatarUrl, knobs, selectedVoiceId, speakers, duration, budgetCap, podcastMode, onCreate]);

  const reset = () => {
    setTopicInput("");
    setSpeakers(1);
    setDuration(1);
    setBudgetCap(50);
    setVoiceFile(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarUrl(null);
    setMakingPresentable(false);
    setEnhancingTopic(false);
    setEnhanceTopicProgressIndex(0);
    setKnobs({ ...defaultKnobs });
    setSelectedVoiceId("Wise_Woman");
    setPlaceholderIndex(0);
    setPodcastMode("audio_video");
  };

  const handleAvatarSelectFromLibrary = React.useCallback((url: string) => {
    setAvatarFile(null);
    setAvatarPreview(url);
    setAvatarUrl(url);
  }, []);

  const handleAvatarChange = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.error('Please select an image file');
        return;
      }
      // Validate file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        console.error('Image file size must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload image immediately to get URL (for "Make Presentable" feature)
      try {
        const { podcastApi } = await import("../../services/podcastApi");
        const uploadResult = await podcastApi.uploadAvatar(file);
        setAvatarUrl(uploadResult.avatar_url);
      } catch (error) {
        console.error('Avatar upload failed:', error);
        // Continue with local preview - upload will happen on submit
      }
    }
  }, []);

  const handleCameraSelfie = React.useCallback(async (imageDataUrl: string) => {
    try {
      // Convert dataURL to File object
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      
      // Set the file and preview
      setAvatarFile(file);
      setAvatarPreview(imageDataUrl);
      
      // Upload image immediately to get URL (for "Make Presentable" feature)
      try {
        const { podcastApi } = await import("../../services/podcastApi");
        const uploadResult = await podcastApi.uploadAvatar(file);
        setAvatarUrl(uploadResult.avatar_url);
      } catch (error) {
        console.error('Avatar upload failed:', error);
        // Continue with local preview - upload will happen on submit
      }
      
      // Close camera dialog
      setCameraSelfieOpen(false);
    } catch (error) {
      console.error('Failed to process selfie:', error);
    }
  }, []);

  const handleRemoveAvatar = React.useCallback(() => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarUrl(null);
    if (avatarPreviewBlobUrl && avatarPreviewBlobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreviewBlobUrl);
    }
    setAvatarPreviewBlobUrl(null);
    setMakingPresentable(false);
  }, [avatarPreviewBlobUrl]);

  const handleUseBrandAvatar = React.useCallback(async () => {
    if (brandAvatarFromDb) {
      setAvatarFile(null);
      setAvatarPreview(brandAvatarFromDb);
      setAvatarUrl(brandAvatarFromDb);
      // Ensure the blob URL is set for the preview logic
      if (brandAvatarBlobUrl) {
        setAvatarPreviewBlobUrl(brandAvatarBlobUrl);
      }
      return;
    }
    
    if (loadingBrandAvatar) return;
    try {
      setLoadingBrandAvatar(true);
      const result = await getLatestBrandAvatar();
      if (result.success && result.image_url) {
        setAvatarFile(null);
        setAvatarPreview(result.image_url);
        setAvatarUrl(result.image_url);
        setBrandAvatarFromDb(result.image_url);
      } else {
        console.error(result.error || result.message || "No brand avatar found");
      }
    } catch (error) {
      console.error("Failed to load brand avatar:", error);
    } finally {
      setLoadingBrandAvatar(false);
    }
  }, [brandAvatarFromDb, brandAvatarBlobUrl, loadingBrandAvatar]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setAvatarTab(newValue);
    if (newValue === 0) {
      // Switch to brand avatar tab - it's already pre-fetched on mount
    } else if (newValue === 1) {
      // Asset Library tab - clear current selection so user must choose
      setAvatarUrl(null);
      setAvatarPreview(null);
      setAvatarFile(null);
    } else if (newValue === 2) {
      // Upload tab - clear if no file uploaded yet to show dropzone clean state
      if (!avatarFile) {
        setAvatarUrl(null);
        setAvatarPreview(null);
      }
    }
  };

  // Initialize with Brand Avatar removed - user must explicitly choose or it's AI generated
  useEffect(() => {
    // We used to auto-load here, but now we leave it empty to allow AI generation later
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMakePresentable = React.useCallback(async () => {
    if (!avatarUrl || makingPresentable) return;
    
    try {
      setMakingPresentable(true);
      const { podcastApi } = await import("../../services/podcastApi");
      const result = await podcastApi.makeAvatarPresentable(avatarUrl);
      
      if (result.avatar_url) {
        // Fetch the transformed image as blob to display
        const { aiApiClient } = await import("../../api/client");
        const response = await aiApiClient.get(result.avatar_url, { responseType: 'blob' });
        const blobUrl = URL.createObjectURL(response.data);
        
        // Revoke old blob URL if exists
        if (avatarPreviewBlobUrl && avatarPreviewBlobUrl.startsWith("blob:")) {
          URL.revokeObjectURL(avatarPreviewBlobUrl);
        }
        
        setAvatarPreviewBlobUrl(blobUrl);
        setAvatarPreview(result.avatar_url);
        setAvatarUrl(result.avatar_url);
      }
    } catch (error) {
      console.error('Failed to make avatar presentable:', error);
      // Could show error message to user
    } finally {
      setMakingPresentable(false);
    }
  }, [avatarUrl, makingPresentable, avatarPreviewBlobUrl]);

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08)",
        p: { xs: 3, md: 4.5 },
      }}
    >
      <Stack spacing={3.5}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="stretch">
          <Box sx={{ flex: 1 }}>
            <TopicUrlInput
              value={topicInput}
              onChange={setTopicInput}
              isUrl={isUrl}
              showAIDetailsButton={showAIDetailsButton}
              onAIDetailsClick={handleAIDetailsClick}
              onTrendingTopicsClick={() => setTrendingModalOpen(true)}
              onCategoryResearchClick={handleCategoryResearchClick}
              placeholderIndex={placeholderIndex}
              loading={enhancingTopic}
              loadingMessage={enhanceTopicMessage}
              extractedData={websiteData}
              setExtractedData={setWebsiteData}
              trendingLoading={trendingLoading}
              categoryResearchLoading={categoryLoading}
              estimatedCost={estimatedCost}
              duration={duration}
              speakers={speakers}
              podcastMode={podcastMode}
              knobs={knobs}
            />
          </Box>

          <Box sx={{ width: { xs: "100%", md: "320px" } }}>
            <PodcastConfiguration
              duration={duration}
              setDuration={setDuration}
              speakers={speakers}
              setSpeakers={setSpeakers}
              podcastMode={podcastMode}
              setPodcastMode={setPodcastMode}
            />
          </Box>
        </Stack>
        
        <AvatarSelector
          avatarTab={avatarTab}
          setAvatarTab={handleTabChange}
          avatarFile={avatarFile}
          avatarPreview={avatarPreview}
          avatarUrl={avatarUrl}
          loadingBrandAvatar={loadingBrandAvatar}
          handleUseBrandAvatar={handleUseBrandAvatar}
          handleAvatarSelectFromLibrary={handleAvatarSelectFromLibrary}
          handleAvatarChange={handleAvatarChange}
          handleCameraSelfie={handleCameraSelfie}
          handleRemoveAvatar={handleRemoveAvatar}
          handleMakePresentable={handleMakePresentable}
          makingPresentable={makingPresentable}
          avatarPreviewBlobUrl={avatarPreviewBlobUrl}
          brandAvatarFromDb={brandAvatarFromDb}
          brandAvatarBlobUrl={brandAvatarBlobUrl}
          cameraSelfieOpen={cameraSelfieOpen}
          setCameraSelfieOpen={setCameraSelfieOpen}
          podcastMode={podcastMode}
        />

        <VoiceSelector
          value={selectedVoiceId}
          onChange={setSelectedVoiceId}
          showVoiceClone={true}
        />

        <CreateActions
          reset={reset}
          submit={submit}
          canSubmit={canSubmit}
          isSubmitting={isSubmitting}
          announcement={announcement}
          onAnnouncementClear={onAnnouncementClear}
          error={submitError}
        />

        {/* Enhanced Topic Choices Modal */}
        <EnhancedTopicChoicesModal
          open={choicesModalOpen}
          onClose={() => setChoicesModalOpen(false)}
          enhancedChoices={enhancedChoices}
          enhancedRationales={enhancedRationales}
          onSelectChoice={handleChoiceSelection}
          loading={enhancingTopic}
        />

        {/* Trending Topics Modal */}
        <TrendingTopicsModal
          open={trendingModalOpen}
          onClose={() => setTrendingModalOpen(false)}
          onSelectTopic={(topic) => setTopicInput(topic)}
          initialKeywords={topicInput}
        />

        {/* Category Research Modal */}
        <CategoryResearchModal
          open={categoryResearchOpen}
          onClose={() => setCategoryResearchOpen(false)}
          category={selectedCategory}
          keyword={topicInput}
          websiteUrl={selectedCategory === "personal-site" ? topicInput : undefined}
          loading={categoryLoading}
          topics={categoryTopics}
          error={categoryError}
          onSelectTopic={(topic) => {
            // Save topic context
            const selectedTopicData = categoryTopics.find(t => t.title === topic);
            if (selectedTopicData) {
              setTopicContext({
                category: selectedCategory,
                topics: categoryTopics.map(t => ({title: t.title, url: t.url, snippet: t.snippet, score: t.score})),
                selected_topic: {
                  title: selectedTopicData.title,
                  url: selectedTopicData.url,
                  snippet: selectedTopicData.snippet,
                },
              });
            }
            setTopicInput(topic);
            setCategoryResearchOpen(false);
          }}
          onRedoSearch={handleCategoryRedoSearch}
          onConfirmSelection={(selectedTopics) => {
            if (selectedTopics.length > 0) {
              // Save topic context
              const firstSelected = categoryTopics.find(t => t.title === selectedTopics[0]);
              if (firstSelected) {
                setTopicContext({
                  category: selectedCategory,
                  topics: categoryTopics.map(t => ({title: t.title, url: t.url, snippet: t.snippet, score: t.score})),
                  selected_topic: {
                    title: firstSelected.title,
                    url: firstSelected.url,
                    snippet: firstSelected.snippet,
                  },
                });
              }
              setTopicInput(selectedTopics[0]);
            }
            setCategoryResearchOpen(false);
          }}
          isCached={categoryCached}
        />

        {/* Enhance Topic Progress Modal */}
        <Dialog
          open={showEnhanceProgressModal}
          disableEscapeKeyDown={false}
          onClose={() => setShowEnhanceProgressModal(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              backgroundColor: "#1e1b4b",
              color: "#fff",
              borderRadius: 3,
              boxShadow: "0 8px 40px rgba(49, 46, 129, 0.4)",
            },
          }}
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, fontWeight: 600 }}>
            <CircularProgress size={20} sx={{ color: "#a78bfa" }} />
            Enhancing Your Topic
          </DialogTitle>
          <DialogContent sx={{ textAlign: "center", py: 4 }}>
            <Box sx={{ mb: 3 }}>
              <CircularProgress 
                size={60} 
                thickness={4}
                sx={{ 
                  color: "#a78bfa",
                  mb: 2,
                }} 
              />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: "#fff" }}>
              {enhanceTopicMessage || "Processing your topic..."}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 2 }}>
              This may take a few seconds
            </Typography>
            
            {/* Context info */}
            <Box sx={{ mt: 3, p: 2, bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", display: "block", mb: 1 }}>
                Using context from:
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                {websiteData && (
                  <Chip 
                    size="small" 
                    label={websiteData.title ? `${websiteData.title.slice(0, 15)}...` : "Website"} 
                    sx={{ bgcolor: "rgba(167, 139, 250, 0.3)", color: "#fff" }}
                  />
                )}
                {topicContext && (
                  <Chip 
                    size="small" 
                    label={`${topicContext.category.charAt(0).toUpperCase() + topicContext.category.slice(1)} Research`}
                    sx={{ bgcolor: "rgba(16, 185, 129, 0.3)", color: "#fff" }}
                  />
                )}
                {(!websiteData && !topicContext) && (
                  <Chip 
                    size="small" 
                    label="Topic only"
                    sx={{ bgcolor: "rgba(100, 116, 139, 0.3)", color: "#fff" }}
                  />
                )}
              </Stack>
            </Box>
          </DialogContent>
        </Dialog>
      </Stack>
    </Paper>
  );
};
