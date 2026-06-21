"""
Enhanced Linguistic Analysis Service
Advanced analysis for better writing style mimicry and persona quality.
"""

import re
import json
from typing import Dict, Any, List, Tuple
from collections import Counter, defaultdict
from loguru import logger
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
from nltk.tag import pos_tag
from textstat import flesch_reading_ease, flesch_kincaid_grade


class EnhancedLinguisticAnalyzer:
    """Advanced linguistic analysis for persona creation and improvement."""

    def __init__(self):
        """Initialize the linguistic analyzer — minimal setup, spaCy loaded on first use."""
        self.nlp = None
        self.spacy_available = False
        self._initialized = False

    def _ensure_initialized(self):
        """Lazily load spaCy model and NLTK data on first method call."""
        if self._initialized:
            return

        # spaCy is REQUIRED for high-quality persona generation
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
            self.spacy_available = True
            logger.debug("SUCCESS: spaCy model loaded successfully - Enhanced linguistic analysis available")
        except ImportError as e:
            logger.error(f"ERROR: spaCy is REQUIRED for persona generation. Install with: pip install spacy && python -m spacy download en_core_web_sm")
            raise ImportError("spaCy is required for enhanced persona generation. Install with: pip install spacy && python -m spacy download en_core_web_sm") from e
        except OSError as e:
            logger.error(f"ERROR: spaCy model 'en_core_web_sm' is REQUIRED. Download with: python -m spacy download en_core_web_sm")
            raise OSError("spaCy model 'en_core_web_sm' is required. Download with: python -m spacy download en_core_web_sm") from e

        # Download required NLTK data
        try:
            nltk.data.find('tokenizers/punkt_tab')
            nltk.data.find('corpora/stopwords')
            nltk.data.find('taggers/averaged_perceptron_tagger')
        except LookupError:
            logger.warning("NLTK data not found. Downloading required data...")
            nltk.download('punkt_tab', quiet=True)
            nltk.download('stopwords', quiet=True)
            nltk.download('averaged_perceptron_tagger', quiet=True)

        self._initialized = True

    def analyze_writing_style(self, text_samples: List[str]) -> Dict[str, Any]:
        """
        Comprehensive analysis of writing style from multiple text samples.

        This is the public entry point used by the persona generation flow
        to ground the LLM's `linguistic_fingerprint` claims in real
        measurements from the brand's own content.

        Args:
            text_samples: List of text samples to analyze.

        Returns:
            Dict with keys: basic_metrics, sentence_analysis, vocabulary_analysis,
            rhetorical_analysis, style_patterns, readability_analysis,
            emotional_analysis, consistency_analysis, analysis_metadata.

            On error: {"error": "..."} (caller should treat as empty data).
        """
        self._ensure_initialized()
        try:
            if not text_samples:
                return {"error": "No text samples provided"}

            logger.info(
                f"Analyzing writing style from {len(text_samples)} text samples"
            )

            # Combine all text samples
            combined_text = " ".join(text_samples)

            # Run all sub-analyses
            basic_metrics = self._analyze_basic_metrics(combined_text)
            sentence_analysis = self._analyze_sentence_patterns(combined_text)
            vocabulary_analysis = self._analyze_vocabulary(combined_text)
            rhetorical_analysis = self._analyze_rhetorical_devices(combined_text)
            style_patterns = self._analyze_style_patterns(combined_text)
            readability_analysis = self._analyze_readability(combined_text)
            emotional_analysis = self._analyze_emotional_tone(combined_text)
            consistency_analysis = self._analyze_consistency(text_samples)

            return {
                "basic_metrics": basic_metrics,
                "sentence_analysis": sentence_analysis,
                "vocabulary_analysis": vocabulary_analysis,
                "rhetorical_analysis": rhetorical_analysis,
                "style_patterns": style_patterns,
                "readability_analysis": readability_analysis,
                "emotional_analysis": emotional_analysis,
                "consistency_analysis": consistency_analysis,
                "analysis_metadata": {
                    "sample_count": len(text_samples),
                    "total_words": basic_metrics.get("total_words", 0),
                    "total_sentences": basic_metrics.get("total_sentences", 0),
                    "analysis_confidence": self._calculate_analysis_confidence(text_samples),
                },
            }

        except Exception as e:
            logger.error(f"Error analyzing writing style: {str(e)}")
            return {"error": f"Failed to analyze writing style: {str(e)}"}

    def _analyze_basic_metrics(self, text: str) -> Dict[str, Any]:
        """Analyze basic text metrics."""
        sentences = sent_tokenize(text)
        words = word_tokenize(text.lower())

        # Filter out punctuation
        words = [word for word in words if word.isalpha()]

        return {
            "total_words": len(words),
            "total_sentences": len(sentences),
            "average_sentence_length": len(words) / len(sentences) if sentences else 0,
            "average_word_length": sum(len(word) for word in words) / len(words) if words else 0,
            "paragraph_count": len(text.split('\n\n')),
            "character_count": len(text),
            "character_count_no_spaces": len(text.replace(' ', ''))
        }

    def _analyze_sentence_patterns(self, text: str) -> Dict[str, Any]:
        """Analyze sentence structure patterns."""
        sentences = sent_tokenize(text)

        sentence_lengths = [len(word_tokenize(sent)) for sent in sentences]
        sentence_types = []

        for sentence in sentences:
            if sentence.endswith('?'):
                sentence_types.append('question')
            elif sentence.endswith('!'):
                sentence_types.append('exclamation')
            else:
                sentence_types.append('declarative')

        # Analyze sentence beginnings
        sentence_beginnings = []
        for sentence in sentences:
            first_word = word_tokenize(sentence)[0].lower() if word_tokenize(sentence) else ""
            sentence_beginnings.append(first_word)

        return {
            "sentence_length_distribution": {
                "min": min(sentence_lengths) if sentence_lengths else 0,
                "max": max(sentence_lengths) if sentence_lengths else 0,
                "average": sum(sentence_lengths) / len(sentence_lengths) if sentence_lengths else 0,
                "median": sorted(sentence_lengths)[len(sentence_lengths)//2] if sentence_lengths else 0
            },
            "sentence_type_distribution": dict(Counter(sentence_types)),
            "common_sentence_starters": dict(Counter(sentence_beginnings).most_common(10)),
            "sentence_complexity": self._analyze_sentence_complexity(sentences)
        }

    def _analyze_vocabulary(self, text: str) -> Dict[str, Any]:
        """Analyze vocabulary patterns and preferences."""
        words = word_tokenize(text.lower())
        words = [word for word in words if word.isalpha()]

        # Remove stopwords for analysis
        stop_words = set(stopwords.words('english'))
        content_words = [word for word in words if word not in stop_words]

        # POS tagging
        pos_tags = pos_tag(words)
        pos_distribution = dict(Counter(tag for word, tag in pos_tags))

        # Vocabulary richness
        unique_words = set(words)
        unique_content_words = set(content_words)

        return {
            "vocabulary_size": len(unique_words),
            "content_vocabulary_size": len(unique_content_words),
            "lexical_diversity": len(unique_words) / len(words) if words else 0,
            "most_frequent_words": dict(Counter(words).most_common(20)),
            "most_frequent_content_words": dict(Counter(content_words).most_common(20)),
            "pos_distribution": pos_distribution,
            "word_length_distribution": {
                "short_words": len([w for w in words if len(w) <= 4]),
                "medium_words": len([w for w in words if 5 <= len(w) <= 8]),
                "long_words": len([w for w in words if len(w) > 8])
            },
            "vocabulary_sophistication": self._analyze_vocabulary_sophistication(words)
        }

    def _analyze_rhetorical_devices(self, text: str) -> Dict[str, Any]:
        """Analyze rhetorical devices and techniques."""
        sentences = sent_tokenize(text)

        rhetorical_devices = {
            "questions": len([s for s in sentences if s.strip().endswith('?')]),
            "exclamations": len([s for s in sentences if s.strip().endswith('!')]),
            "repetition": self._find_repetition_patterns(text),
            "alliteration": self._find_alliteration(text),
            "metaphors": self._find_metaphors(text),
            "analogies": self._find_analogies(text),
            "lists": self._find_lists(text),
            "contrasts": self._find_contrasts(text)
        }

        return rhetorical_devices

    def _analyze_style_patterns(self, text: str) -> Dict[str, Any]:
        """Analyze writing style patterns."""
        return {
            "formality_level": self._assess_formality(text),
            "personal_pronouns": self._count_personal_pronouns(text),
            "passive_voice": self._count_passive_voice(text),
            "contractions": self._count_contractions(text),
            "transition_words": self._find_transition_words(text),
            "hedging_language": self._find_hedging_language(text),
            "emphasis_patterns": self._find_emphasis_patterns(text)
        }

    def _analyze_readability(self, text: str) -> Dict[str, Any]:
        """Analyze readability metrics."""
        try:
            return {
                "flesch_reading_ease": flesch_reading_ease(text),
                "flesch_kincaid_grade": flesch_kincaid_grade(text),
                "reading_level": self._determine_reading_level(flesch_reading_ease(text)),
                "complexity_score": self._calculate_complexity_score(text)
            }
        except Exception as e:
            logger.warning(f"Error calculating readability: {e}")
            return {"error": "Could not calculate readability metrics"}

    def _analyze_emotional_tone(self, text: str) -> Dict[str, Any]:
        """Analyze emotional tone and sentiment patterns."""
        # Simple sentiment analysis based on word patterns
        positive_words = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'enjoy']
        negative_words = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'horrible', 'worst', 'problem', 'issue']

        words = word_tokenize(text.lower())
        positive_count = sum(1 for word in words if word in positive_words)
        negative_count = sum(1 for word in words if word in negative_words)

        return {
            "sentiment_bias": "positive" if positive_count > negative_count else "negative" if negative_count > positive_count else "neutral",
            "positive_word_count": positive_count,
            "negative_word_count": negative_count,
            "emotional_intensity": self._calculate_emotional_intensity(text),
            "tone_consistency": self._assess_tone_consistency(text)
        }

    def _analyze_consistency(self, text_samples: List[str]) -> Dict[str, Any]:
        """Analyze consistency across multiple text samples."""
        if len(text_samples) < 2:
            return {"consistency_score": 100, "note": "Only one sample provided"}

        # Analyze consistency in various metrics
        sentence_lengths = []
        vocabulary_sets = []

        for sample in text_samples:
            sentences = sent_tokenize(sample)
            words = word_tokenize(sample.lower())
            words = [word for word in words if word.isalpha()]

            sentence_lengths.append([len(word_tokenize(sent)) for sent in sentences])
            vocabulary_sets.append(set(words))

        # Calculate consistency scores
        avg_sentence_length_consistency = self._calculate_metric_consistency(
            [sum(lengths)/len(lengths) for lengths in sentence_lengths]
        )

        vocabulary_overlap = self._calculate_vocabulary_overlap(vocabulary_sets)

        return {
            "consistency_score": (avg_sentence_length_consistency + vocabulary_overlap) / 2,
            "sentence_length_consistency": avg_sentence_length_consistency,
            "vocabulary_consistency": vocabulary_overlap,
            "style_stability": self._assess_style_stability(text_samples)
        }

    def _calculate_analysis_confidence(self, text_samples: List[str]) -> float:
        """Calculate confidence in the analysis based on data quality."""
        if not text_samples:
            return 0.0

        total_words = sum(len(word_tokenize(sample)) for sample in text_samples)
        sample_count = len(text_samples)

        # Confidence based on amount of data
        word_confidence = min(100, (total_words / 1000) * 100)  # 1000 words = 100% confidence
        sample_confidence = min(100, (sample_count / 5) * 100)  # 5 samples = 100% confidence

        return (word_confidence + sample_confidence) / 2

    # Helper methods for specific analyses
    def _analyze_sentence_complexity(self, sentences: List[str]) -> Dict[str, Any]:
        """Analyze sentence complexity patterns."""
        complex_sentences = 0
        compound_sentences = 0

        for sentence in sentences:
            if ',' in sentence and ('and' in sentence or 'but' in sentence or 'or' in sentence):
                compound_sentences += 1
            if len(word_tokenize(sentence)) > 20:
                complex_sentences += 1

        return {
            "complex_sentence_ratio": complex_sentences / len(sentences) if sentences else 0,
            "compound_sentence_ratio": compound_sentences / len(sentences) if sentences else 0,
            "average_clauses_per_sentence": self._count_clauses(sentences)
        }

    def _analyze_vocabulary_sophistication(self, words: List[str]) -> Dict[str, Any]:
        """Analyze vocabulary sophistication level."""
        # Simple heuristic based on word length and frequency
        long_words = [w for w in words if len(w) > 7]
        rare_words = [w for w in words if len(w) > 5]  # Simplified rare word detection

        return {
            "sophistication_score": (len(long_words) + len(rare_words)) / len(words) * 100 if words else 0,
            "long_word_ratio": len(long_words) / len(words) if words else 0,
            "rare_word_ratio": len(rare_words) / len(words) if words else 0
        }

    def _find_repetition_patterns(self, text: str) -> Dict[str, Any]:
        """Find repetition patterns in text."""
        words = word_tokenize(text.lower())
        word_freq = Counter(words)

        # Find words that appear multiple times
        repeated_words = {word: count for word, count in word_freq.items() if count > 2}

        return {
            "repeated_words": repeated_words,
            "repetition_score": len(repeated_words) / len(set(words)) * 100 if words else 0
        }

    def _find_alliteration(self, text: str) -> List[str]:
        """Find alliteration patterns."""
        sentences = sent_tokenize(text)
        alliterations = []

        for sentence in sentences:
            words = word_tokenize(sentence.lower())
            words = [word for word in words if word.isalpha()]

            if len(words) >= 2:
                for i in range(len(words) - 1):
                    if words[i][0] == words[i+1][0]:
                        alliterations.append(f"{words[i]} {words[i+1]}")

        return alliterations

    def _find_metaphors(self, text: str) -> List[str]:
        """Find potential metaphors in text."""
        # Simple metaphor detection based on common patterns
        metaphor_patterns = [
            r'\b(is|are|was|were)\s+(like|as)\s+',
            r'\b(like|as)\s+\w+\s+(is|are|was|were)',
            r'\b(metaphorically|figuratively)'
        ]

        metaphors = []
        for pattern in metaphor_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            metaphors.extend(matches)

        return metaphors

    def _find_analogies(self, text: str) -> List[str]:
        """Find analogies in text."""
        analogy_patterns = [
            r'\b(just as|similar to|comparable to|akin to)',
            r'\b(in the same way|likewise|similarly)'
        ]

        analogies = []
        for pattern in analogy_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            analogies.extend(matches)

        return analogies

    def _find_lists(self, text: str) -> List[str]:
        """Find list patterns in text."""
        list_patterns = [
            r'\b(first|second|third|lastly|finally)',
            r'\b(one|two|three|four|five)',
            r'\b(•|\*|\-|\d+\.)'
        ]

        lists = []
        for pattern in list_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            lists.extend(matches)

        return lists

    def _find_contrasts(self, text: str) -> List[str]:
        """Find contrast patterns in text."""
        contrast_words = ['but', 'however', 'although', 'whereas', 'while', 'on the other hand', 'in contrast']
        contrasts = []

        for word in contrast_words:
            if word in text.lower():
                contrasts.append(word)

        return contrasts

    def _assess_formality(self, text: str) -> str:
        """Assess formality level of text."""
        formal_indicators = ['therefore', 'furthermore', 'moreover', 'consequently', 'nevertheless']
        informal_indicators = ['gonna', 'wanna', 'gotta', 'yeah', 'ok', 'cool']

        formal_count = sum(1 for indicator in formal_indicators if indicator in text.lower())
        informal_count = sum(1 for indicator in informal_indicators if indicator in text.lower())

        if formal_count > informal_count:
            return "formal"
        elif informal_count > formal_count:
            return "informal"
        else:
            return "neutral"

    def _count_personal_pronouns(self, text: str) -> Dict[str, int]:
        """Count personal pronouns in text."""
        pronouns = ['i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
                   'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
                   'she', 'her', 'hers', 'herself', 'they', 'them', 'their', 'theirs', 'themselves']

        words = word_tokenize(text.lower())
        pronoun_count = {pronoun: words.count(pronoun) for pronoun in pronouns}

        return pronoun_count

    def _count_passive_voice(self, text: str) -> int:
        """Count passive voice constructions."""
        passive_patterns = [
            r'\b(was|were|is|are|been|being)\s+\w+ed\b',
            r'\b(was|were|is|are|been|being)\s+\w+en\b'
        ]

        passive_count = 0
        for pattern in passive_patterns:
            passive_count += len(re.findall(pattern, text, re.IGNORECASE))

        return passive_count

    def _count_contractions(self, text: str) -> int:
        """Count contractions in text."""
        contraction_pattern = r"\b\w+'\w+\b"
        return len(re.findall(contraction_pattern, text))

    def _find_transition_words(self, text: str) -> List[str]:
        """Find transition words in text."""
        transition_words = ['however', 'therefore', 'furthermore', 'moreover', 'nevertheless',
                          'consequently', 'meanwhile', 'additionally', 'similarly', 'likewise',
                          'on the other hand', 'in contrast', 'for example', 'for instance']

        found_transitions = []
        for word in transition_words:
            if word in text.lower():
                found_transitions.append(word)

        return found_transitions

    def _find_hedging_language(self, text: str) -> List[str]:
        """Find hedging language in text."""
        hedging_words = ['might', 'could', 'possibly', 'perhaps', 'maybe', 'likely', 'probably',
                        'seems', 'appears', 'suggests', 'indicates', 'tends to']

        found_hedging = []
        for word in hedging_words:
            if word in text.lower():
                found_hedging.append(word)

        return found_hedging

    def _find_emphasis_patterns(self, text: str) -> Dict[str, Any]:
        """Find emphasis patterns in text."""
        emphasis_patterns = {
            'bold_asterisks': len(re.findall(r'\*\w+\*', text)),
            'bold_underscores': len(re.findall(r'_\w+_', text)),
            'caps_words': len(re.findall(r'\b[A-Z]{2,}\b', text)),
            'exclamation_points': text.count('!'),
            'emphasis_words': len(re.findall(r'\b(very|really|extremely|absolutely|completely)\b', text, re.IGNORECASE))
        }

        return emphasis_patterns

    def _determine_reading_level(self, flesch_score: float) -> str:
        """Determine reading level from Flesch score."""
        if flesch_score >= 90:
            return "very_easy"
        elif flesch_score >= 80:
            return "easy"
        elif flesch_score >= 70:
            return "fairly_easy"
        elif flesch_score >= 60:
            return "standard"
        elif flesch_score >= 50:
            return "fairly_difficult"
        elif flesch_score >= 30:
            return "difficult"
        else:
            return "very_difficult"

    def _calculate_complexity_score(self, text: str) -> float:
        """Calculate overall complexity score."""
        sentences = sent_tokenize(text)
        words = word_tokenize(text.lower())
        words = [word for word in words if word.isalpha()]

        if not sentences or not words:
            return 0.0

        # Factors: sentence length, word length, vocabulary diversity
        avg_sentence_length = len(words) / len(sentences)
        avg_word_length = sum(len(word) for word in words) / len(words)
        vocabulary_diversity = len(set(words)) / len(words)

        # Normalize and combine
        complexity = (avg_sentence_length / 20) * 0.4 + (avg_word_length / 10) * 0.3 + vocabulary_diversity * 0.3

        return min(100, complexity * 100)

    def _calculate_emotional_intensity(self, text: str) -> float:
        """Calculate emotional intensity of text."""
        emotional_words = ['amazing', 'incredible', 'fantastic', 'terrible', 'awful', 'horrible',
                          'love', 'hate', 'passion', 'fury', 'joy', 'sorrow', 'excitement', 'fear']

        words = word_tokenize(text.lower())
        emotional_word_count = sum(1 for word in words if word in emotional_words)

        return (emotional_word_count / len(words)) * 100 if words else 0

    def _assess_tone_consistency(self, text: str) -> float:
        """Assess tone consistency throughout text."""
        # Simple heuristic: check for tone shifts
        sentences = sent_tokenize(text)
        if len(sentences) < 2:
            return 100.0

        # Analyze first half vs second half
        mid_point = len(sentences) // 2
        first_half = " ".join(sentences[:mid_point])
        second_half = " ".join(sentences[mid_point:])

        first_tone = self._analyze_emotional_tone(first_half)
        second_tone = self._analyze_emotional_tone(second_half)

        # Calculate consistency based on sentiment similarity
        if first_tone["sentiment_bias"] == second_tone["sentiment_bias"]:
            return 100.0
        else:
            return 50.0

    def _calculate_metric_consistency(self, values: List[float]) -> float:
        """Calculate consistency of a metric across samples."""
        if len(values) < 2:
            return 100.0

        mean_value = sum(values) / len(values)
        variance = sum((x - mean_value) ** 2 for x in values) / len(values)
        std_dev = variance ** 0.5

        # Convert to consistency score (lower std dev = higher consistency)
        consistency = max(0, 100 - (std_dev / mean_value * 100)) if mean_value > 0 else 100

        return consistency

    def _calculate_vocabulary_overlap(self, vocabulary_sets: List[set]) -> float:
        """Calculate vocabulary overlap across samples."""
        if len(vocabulary_sets) < 2:
            return 100.0

        # Calculate pairwise overlaps
        overlaps = []
        for i in range(len(vocabulary_sets)):
            for j in range(i + 1, len(vocabulary_sets)):
                intersection = len(vocabulary_sets[i] & vocabulary_sets[j])
                union = len(vocabulary_sets[i] | vocabulary_sets[j])
                overlap = (intersection / union * 100) if union > 0 else 0
                overlaps.append(overlap)

        return sum(overlaps) / len(overlaps) if overlaps else 0

    def _assess_style_stability(self, text_samples: List[str]) -> Dict[str, Any]:
        """Assess style stability across samples."""
        if len(text_samples) < 2:
            return {"stability_score": 100, "note": "Only one sample provided"}

        # Analyze consistency in key style metrics
        metrics = []
        for sample in text_samples:
            sample_metrics = {
                "avg_sentence_length": len(word_tokenize(sample)) / len(sent_tokenize(sample)),
                "formality": self._assess_formality(sample),
                "emotional_intensity": self._calculate_emotional_intensity(sample)
            }
            metrics.append(sample_metrics)

        # Calculate stability scores
        sentence_length_stability = self._calculate_metric_consistency(
            [m["avg_sentence_length"] for m in metrics]
        )

        emotional_stability = self._calculate_metric_consistency(
            [m["emotional_intensity"] for m in metrics]
        )

        # Formality consistency
        formality_values = [m["formality"] for m in metrics]
        formality_consistency = 100 if len(set(formality_values)) == 1 else 50

        overall_stability = (sentence_length_stability + emotional_stability + formality_consistency) / 3

        return {
            "stability_score": overall_stability,
            "sentence_length_stability": sentence_length_stability,
            "emotional_stability": emotional_stability,
            "formality_consistency": formality_consistency
        }

    def _count_clauses(self, sentences: List[str]) -> float:
        """Count average clauses per sentence."""
        total_clauses = 0
        for sentence in sentences:
            # Simple clause counting based on conjunctions and punctuation
            clauses = len(re.findall(r'[,;]', sentence)) + 1
            total_clauses += clauses

        return total_clauses / len(sentences) if sentences else 0


# ── Singleton factory (avoids duplicate spaCy instances across modules) ──────────
_analyzer_instance = None


def get_linguistic_analyzer() -> EnhancedLinguisticAnalyzer:
    """Return the shared singleton instance."""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = EnhancedLinguisticAnalyzer()
    return _analyzer_instance
