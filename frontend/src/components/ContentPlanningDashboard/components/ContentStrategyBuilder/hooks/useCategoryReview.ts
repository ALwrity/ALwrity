import { useState, useEffect } from 'react';

interface UseCategoryReviewProps {
  completionStats: any;
  setError: (error: string | null) => void;
  setActiveCategory: (category: string | null) => void;
}

const STORAGE_KEY = 'strategy_reviewed_categories';

// Helper functions for localStorage persistence
const loadReviewedCategories = (): Set<string> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const categories = JSON.parse(stored);
      return new Set(Array.isArray(categories) ? categories : []);
    }
  } catch (error) {
    console.warn('Failed to load reviewed categories from localStorage:', error);
  }
  return new Set();
};

const saveReviewedCategories = (categories: Set<string>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(categories)));
  } catch (error) {
    console.warn('Failed to save reviewed categories to localStorage:', error);
  }
};

export const useCategoryReview = ({ completionStats, setError, setActiveCategory }: UseCategoryReviewProps) => {
  // Load reviewed categories from localStorage on mount
  const [reviewedCategories, setReviewedCategories] = useState<Set<string>>(() => loadReviewedCategories());
  const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);
  const [categoryCompletionMessage, setCategoryCompletionMessage] = useState<string | null>(null);

  // Clear category completion message after 3 seconds
  useEffect(() => {
    if (categoryCompletionMessage) {
      const timer = setTimeout(() => {
        setCategoryCompletionMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [categoryCompletionMessage]);

  const handleConfirmCategoryReview = async (activeCategory: string | null) => {
    if (!activeCategory) return;

    setIsMarkingReviewed(true);
    setCategoryCompletionMessage('🔄 Marking category as reviewed...');

    try {
      // Mark category as reviewed
      setReviewedCategories(prev => {
        const updated = new Set([...Array.from(prev), activeCategory]);
        // Persist to localStorage
        saveReviewedCategories(updated);
        return updated;
      });

      // Get category name for display
      const categoryName = activeCategory.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');

      setCategoryCompletionMessage(`✅ ${categoryName} reviewed and confirmed!`);

      // Auto-navigate to next unreviewed category on the next tick
      // (the artificial 1.5s setTimeout was removed -- React state
      // updates batch, so the navigation lands on the same frame as
      // the toast update).
      const allCategories = Object.keys(completionStats.category_completion);
      const currentIndex = allCategories.indexOf(activeCategory);

      // Use the updated reviewedCategories state that includes the current category
      const updatedReviewedCategories = new Set([...Array.from(reviewedCategories), activeCategory]);

      const nextUnreviewedCategory = allCategories.find((categoryId, index) => {
        if (index <= currentIndex) return false;
        return !updatedReviewedCategories.has(categoryId);
      });

      if (nextUnreviewedCategory) {
        // Actually navigate to the next category
        setActiveCategory(nextUnreviewedCategory);
        setCategoryCompletionMessage(`🎯 Moving to next category: ${nextUnreviewedCategory.split('_').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')}`);
      } else {
        setCategoryCompletionMessage('🎉 All categories reviewed and confirmed! You can now create your strategy.');
      }
    } catch (error: any) {
      setError(`Error marking category as reviewed: ${error.message || 'Unknown error'}`);
      console.error('Error in handleConfirmCategoryReview:', error);
    } finally {
      setIsMarkingReviewed(false);
    }
  };

  const isCategoryReviewed = (categoryId: string) => {
    return reviewedCategories.has(categoryId);
  };

  const getNextUnreviewedCategory = (currentCategoryId: string) => {
    const allCategories = Object.keys(completionStats.category_completion);
    const currentIndex = allCategories.indexOf(currentCategoryId);
    
    // Use the updated reviewedCategories state that includes the current category
    const updatedReviewedCategories = new Set([...Array.from(reviewedCategories), currentCategoryId]);
    
    return allCategories.find((categoryId, index) => {
      if (index <= currentIndex) return false;
      return !updatedReviewedCategories.has(categoryId);
    });
  };

  return {
    reviewedCategories,
    isMarkingReviewed,
    categoryCompletionMessage,
    handleConfirmCategoryReview,
    isCategoryReviewed,
    getNextUnreviewedCategory,
    setReviewedCategories
  };
}; 