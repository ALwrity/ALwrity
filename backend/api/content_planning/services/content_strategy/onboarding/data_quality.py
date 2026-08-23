"""
Data Quality Service
Onboarding data quality assessment.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class DataQualityService:
    """Service for assessing data quality and validation."""

    def __init__(self):
        self.quality_thresholds = {
            'excellent': 0.9,
            'good': 0.7,
            'fair': 0.5,
            'poor': 0.3
        }
        
        self.data_freshness_threshold = timedelta(hours=24)
        self.max_data_age = timedelta(days=30)

    def assess_onboarding_data_quality(self, integrated_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess the overall quality of onboarding data."""
        try:
            logger.info("Assessing onboarding data quality")

            quality_assessment = {
                'overall_score': 0.0,
                'completeness': 0.0,
                'freshness': 0.0,
                'accuracy': 0.0,
                'relevance': 0.0,
                'consistency': 0.0,
                'confidence': 0.0,
                'quality_level': 'poor',
                'recommendations': [],
                'issues': [],
                'assessment_timestamp': datetime.utcnow().isoformat()
            }

            # Assess each data source
            website_quality = self._assess_website_analysis_quality(integrated_data.get('website_analysis', {}))
            research_quality = self._assess_research_preferences_quality(integrated_data.get('research_preferences', {}))
            api_quality = self._assess_api_keys_quality(integrated_data.get('api_keys_data', {}))
            session_quality = self._assess_onboarding_session_quality(integrated_data.get('onboarding_session', {}))

            # Calculate overall quality metrics
            quality_assessment['completeness'] = self._calculate_completeness_score(
                website_quality, research_quality, api_quality, session_quality
            )
            
            quality_assessment['freshness'] = self._calculate_freshness_score(
                website_quality, research_quality, api_quality, session_quality
            )
            
            quality_assessment['accuracy'] = self._calculate_accuracy_score(
                website_quality, research_quality, api_quality, session_quality
            )
            
            quality_assessment['relevance'] = self._calculate_relevance_score(
                website_quality, research_quality, api_quality, session_quality
            )
            
            quality_assessment['consistency'] = self._calculate_consistency_score(
                website_quality, research_quality, api_quality, session_quality
            )

            # Calculate confidence and overall score
            quality_assessment['confidence'] = (
                quality_assessment['completeness'] + 
                quality_assessment['freshness'] + 
                quality_assessment['accuracy'] + 
                quality_assessment['relevance'] + 
                quality_assessment['consistency']
            ) / 5

            quality_assessment['overall_score'] = quality_assessment['confidence']

            # Determine quality level
            quality_assessment['quality_level'] = self._determine_quality_level(quality_assessment['overall_score'])

            # Generate recommendations and identify issues
            quality_assessment['recommendations'] = self._generate_quality_recommendations(quality_assessment)
            quality_assessment['issues'] = self._identify_quality_issues(quality_assessment)

            logger.info(f"Data quality assessment completed. Overall score: {quality_assessment['overall_score']:.2f}")
            return quality_assessment

        except Exception as e:
            logger.error(f"Error assessing data quality: {str(e)}")
            # Raise exception instead of returning fallback data
            raise Exception(f"Failed to assess data quality: {str(e)}")

    def _assess_website_analysis_quality(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess quality of website analysis data."""
        try:
            quality_metrics = {
                'completeness': 0.0,
                'freshness': 0.0,
                'accuracy': 0.0,
                'relevance': 0.0,
                'consistency': 0.0
            }

            if not website_data:
                return quality_metrics

            # Completeness assessment
            required_fields = ['domain', 'industry', 'business_type', 'target_audience', 'content_goals']
            present_fields = sum(1 for field in required_fields if website_data.get(field))
            quality_metrics['completeness'] = present_fields / len(required_fields)

            # Freshness assessment
            if website_data.get('created_at'):
                try:
                    created_at = datetime.fromisoformat(website_data['created_at'].replace('Z', '+00:00'))
                    age = datetime.utcnow() - created_at
                    quality_metrics['freshness'] = self._calculate_freshness_score_from_age(age)
                except Exception:
                    quality_metrics['freshness'] = 0.5

            # Accuracy assessment (based on data presence and format)
            accuracy_score = 0.0
            if website_data.get('domain') and isinstance(website_data['domain'], str):
                accuracy_score += 0.2
            if website_data.get('industry') and isinstance(website_data['industry'], str):
                accuracy_score += 0.2
            if website_data.get('business_type') and isinstance(website_data['business_type'], str):
                accuracy_score += 0.2
            if website_data.get('target_audience') and isinstance(website_data['target_audience'], str):
                accuracy_score += 0.2
            if website_data.get('content_goals') and isinstance(website_data['content_goals'], (str, list)):
                accuracy_score += 0.2
            quality_metrics['accuracy'] = accuracy_score

            # Relevance assessment
            relevance_score = 0.0
            if website_data.get('domain'):
                relevance_score += 0.3
            if website_data.get('industry'):
                relevance_score += 0.3
            if website_data.get('content_goals'):
                relevance_score += 0.4
            quality_metrics['relevance'] = relevance_score

            # Consistency assessment
            consistency_score = 0.0
            if website_data.get('domain') and website_data.get('industry'):
                consistency_score += 0.5
            if website_data.get('target_audience') and website_data.get('content_goals'):
                consistency_score += 0.5
            quality_metrics['consistency'] = consistency_score

            return quality_metrics

        except Exception as e:
            logger.error(f"Error assessing website analysis quality: {str(e)}")
            return {'completeness': 0.0, 'freshness': 0.0, 'accuracy': 0.0, 'relevance': 0.0, 'consistency': 0.0}

    def _assess_research_preferences_quality(self, research_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess quality of research preferences data."""
        try:
            quality_metrics = {
                'completeness': 0.0,
                'freshness': 0.0,
                'accuracy': 0.0,
                'relevance': 0.0,
                'consistency': 0.0
            }

            if not research_data:
                return quality_metrics

            # Completeness assessment
            required_fields = ['research_topics', 'content_types', 'target_audience', 'industry_focus']
            present_fields = sum(1 for field in required_fields if research_data.get(field))
            quality_metrics['completeness'] = present_fields / len(required_fields)

            # Freshness assessment
            if research_data.get('created_at'):
                try:
                    created_at = datetime.fromisoformat(research_data['created_at'].replace('Z', '+00:00'))
                    age = datetime.utcnow() - created_at
                    quality_metrics['freshness'] = self._calculate_freshness_score_from_age(age)
                except Exception:
                    quality_metrics['freshness'] = 0.5

            # Accuracy assessment
            accuracy_score = 0.0
            if research_data.get('research_topics') and isinstance(research_data['research_topics'], (str, list)):
                accuracy_score += 0.25
            if research_data.get('content_types') and isinstance(research_data['content_types'], (str, list)):
                accuracy_score += 0.25
            if research_data.get('target_audience') and isinstance(research_data['target_audience'], str):
                accuracy_score += 0.25
            if research_data.get('industry_focus') and isinstance(research_data['industry_focus'], str):
                accuracy_score += 0.25
            quality_metrics['accuracy'] = accuracy_score

            # Relevance assessment
            relevance_score = 0.0
            if research_data.get('research_topics'):
                relevance_score += 0.4
            if research_data.get('content_types'):
                relevance_score += 0.3
            if research_data.get('target_audience'):
                relevance_score += 0.3
            quality_metrics['relevance'] = relevance_score

            # Consistency assessment
            consistency_score = 0.0
            if research_data.get('research_topics') and research_data.get('content_types'):
                consistency_score += 0.5
            if research_data.get('target_audience') and research_data.get('industry_focus'):
                consistency_score += 0.5
            quality_metrics['consistency'] = consistency_score

            return quality_metrics

        except Exception as e:
            logger.error(f"Error assessing research preferences quality: {str(e)}")
            return {'completeness': 0.0, 'freshness': 0.0, 'accuracy': 0.0, 'relevance': 0.0, 'consistency': 0.0}

    def _assess_api_keys_quality(self, api_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess quality of API keys data."""
        try:
            quality_metrics = {
                'completeness': 0.0,
                'freshness': 0.0,
                'accuracy': 0.0,
                'relevance': 0.0,
                'consistency': 0.0
            }

            if not api_data:
                return quality_metrics

            # Completeness assessment
            total_apis = len(api_data)
            active_apis = sum(1 for api_info in api_data.values() if api_info.get('is_active'))
            quality_metrics['completeness'] = active_apis / max(total_apis, 1)

            # Freshness assessment
            freshness_scores = []
            for api_info in api_data.values():
                if api_info.get('last_used'):
                    try:
                        last_used = datetime.fromisoformat(api_info['last_used'].replace('Z', '+00:00'))
                        age = datetime.utcnow() - last_used
                        freshness_scores.append(self._calculate_freshness_score_from_age(age))
                    except Exception:
                        freshness_scores.append(0.5)
            
            quality_metrics['freshness'] = sum(freshness_scores) / len(freshness_scores) if freshness_scores else 0.5

            # Accuracy assessment
            accuracy_score = 0.0
            for api_info in api_data.values():
                if api_info.get('service_name') and api_info.get('is_active'):
                    accuracy_score += 0.5
                if api_info.get('data_available'):
                    accuracy_score += 0.5
            quality_metrics['accuracy'] = accuracy_score / max(len(api_data), 1)

            # Relevance assessment
            relevant_apis = ['google_analytics', 'google_search_console', 'semrush', 'ahrefs', 'moz']
            relevant_count = sum(1 for api_name in api_data.keys() if api_name.lower() in relevant_apis)
            quality_metrics['relevance'] = relevant_count / max(len(api_data), 1)

            # Consistency assessment
            consistency_score = 0.0
            if len(api_data) > 0:
                consistency_score = 0.5  # Basic consistency if APIs exist
                if any(api_info.get('data_available') for api_info in api_data.values()):
                    consistency_score += 0.5
            quality_metrics['consistency'] = consistency_score

            return quality_metrics

        except Exception as e:
            logger.error(f"Error assessing API keys quality: {str(e)}")
            return {'completeness': 0.0, 'freshness': 0.0, 'accuracy': 0.0, 'relevance': 0.0, 'consistency': 0.0}

    def _assess_onboarding_session_quality(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess quality of onboarding session data."""
        try:
            quality_metrics = {
                'completeness': 0.0,
                'freshness': 0.0,
                'accuracy': 0.0,
                'relevance': 0.0,
                'consistency': 0.0
            }

            if not session_data:
                return quality_metrics

            # Completeness assessment
            required_fields = ['session_id', 'completion_percentage', 'completed_steps', 'current_step']
            present_fields = sum(1 for field in required_fields if session_data.get(field))
            quality_metrics['completeness'] = present_fields / len(required_fields)

            # Freshness assessment
            if session_data.get('updated_at'):
                try:
                    updated_at = datetime.fromisoformat(session_data['updated_at'].replace('Z', '+00:00'))
                    age = datetime.utcnow() - updated_at
                    quality_metrics['freshness'] = self._calculate_freshness_score_from_age(age)
                except Exception:
                    quality_metrics['freshness'] = 0.5

            # Accuracy assessment
            accuracy_score = 0.0
            if session_data.get('session_id') and isinstance(session_data['session_id'], str):
                accuracy_score += 0.25
            if session_data.get('completion_percentage') and isinstance(session_data['completion_percentage'], (int, float)):
                accuracy_score += 0.25
            if session_data.get('completed_steps') and isinstance(session_data['completed_steps'], (list, int)):
                accuracy_score += 0.25
            if session_data.get('current_step') and isinstance(session_data['current_step'], (str, int)):
                accuracy_score += 0.25
            quality_metrics['accuracy'] = accuracy_score

            # Relevance assessment
            relevance_score = 0.0
            if session_data.get('completion_percentage', 0) > 50:
                relevance_score += 0.5
            if session_data.get('session_data'):
                relevance_score += 0.5
            quality_metrics['relevance'] = relevance_score

            # Consistency assessment
            consistency_score = 0.0
            if session_data.get('completion_percentage') and session_data.get('completed_steps'):
                consistency_score += 0.5
            if session_data.get('current_step') and session_data.get('session_id'):
                consistency_score += 0.5
            quality_metrics['consistency'] = consistency_score

            return quality_metrics

        except Exception as e:
            logger.error(f"Error assessing onboarding session quality: {str(e)}")
            return {'completeness': 0.0, 'freshness': 0.0, 'accuracy': 0.0, 'relevance': 0.0, 'consistency': 0.0}

    def _calculate_completeness_score(self, website_quality: Dict, research_quality: Dict, api_quality: Dict, session_quality: Dict) -> float:
        """Calculate overall completeness score."""
        try:
            scores = [
                website_quality['completeness'],
                research_quality['completeness'],
                api_quality['completeness'],
                session_quality['completeness']
            ]
            return sum(scores) / len(scores)
        except Exception as e:
            logger.error(f"Error calculating completeness score: {str(e)}")
            return 0.0

    def _calculate_freshness_score(self, website_quality: Dict, research_quality: Dict, api_quality: Dict, session_quality: Dict) -> float:
        """Calculate overall freshness score."""
        try:
            scores = [
                website_quality['freshness'],
                research_quality['freshness'],
                api_quality['freshness'],
                session_quality['freshness']
            ]
            return sum(scores) / len(scores)
        except Exception as e:
            logger.error(f"Error calculating freshness score: {str(e)}")
            return 0.0

    def _calculate_accuracy_score(self, website_quality: Dict, research_quality: Dict, api_quality: Dict, session_quality: Dict) -> float:
        """Calculate overall accuracy score."""
        try:
            scores = [
                website_quality['accuracy'],
                research_quality['accuracy'],
                api_quality['accuracy'],
                session_quality['accuracy']
            ]
            return sum(scores) / len(scores)
        except Exception as e:
            logger.error(f"Error calculating accuracy score: {str(e)}")
            return 0.0

    def _calculate_relevance_score(self, website_quality: Dict, research_quality: Dict, api_quality: Dict, session_quality: Dict) -> float:
        """Calculate overall relevance score."""
        try:
            scores = [
                website_quality['relevance'],
                research_quality['relevance'],
                api_quality['relevance'],
                session_quality['relevance']
            ]
            return sum(scores) / len(scores)
        except Exception as e:
            logger.error(f"Error calculating relevance score: {str(e)}")
            return 0.0

    def _calculate_consistency_score(self, website_quality: Dict, research_quality: Dict, api_quality: Dict, session_quality: Dict) -> float:
        """Calculate overall consistency score."""
        try:
            scores = [
                website_quality['consistency'],
                research_quality['consistency'],
                api_quality['consistency'],
                session_quality['consistency']
            ]
            return sum(scores) / len(scores)
        except Exception as e:
            logger.error(f"Error calculating consistency score: {str(e)}")
            return 0.0

    def _calculate_freshness_score_from_age(self, age: timedelta) -> float:
        """Calculate freshness score based on data age."""
        try:
            if age <= self.data_freshness_threshold:
                return 1.0
            elif age <= self.max_data_age:
                # Linear decay from 1.0 to 0.5
                decay_factor = 1.0 - (age - self.data_freshness_threshold) / (self.max_data_age - self.data_freshness_threshold) * 0.5
                return max(0.5, decay_factor)
            else:
                return 0.5  # Minimum freshness for old data
        except Exception as e:
            logger.error(f"Error calculating freshness score from age: {str(e)}")
            return 0.5

    def _determine_quality_level(self, overall_score: float) -> str:
        """Determine quality level based on overall score."""
        try:
            if overall_score >= self.quality_thresholds['excellent']:
                return 'excellent'
            elif overall_score >= self.quality_thresholds['good']:
                return 'good'
            elif overall_score >= self.quality_thresholds['fair']:
                return 'fair'
            else:
                return 'poor'
        except Exception as e:
            logger.error(f"Error determining quality level: {str(e)}")
            return 'poor'

    def _generate_quality_recommendations(self, quality_assessment: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on quality assessment."""
        try:
            recommendations = []

            if quality_assessment['completeness'] < 0.7:
                recommendations.append("Complete missing onboarding data to improve strategy accuracy")

            if quality_assessment['freshness'] < 0.7:
                recommendations.append("Update stale data to ensure current market insights")

            if quality_assessment['accuracy'] < 0.7:
                recommendations.append("Verify data accuracy for better strategy recommendations")

            if quality_assessment['relevance'] < 0.7:
                recommendations.append("Provide more relevant data for targeted strategy development")

            if quality_assessment['consistency'] < 0.7:
                recommendations.append("Ensure data consistency across different sources")

            if quality_assessment['overall_score'] < 0.5:
                recommendations.append("Consider re-running onboarding process for better data quality")

            return recommendations

        except Exception as e:
            logger.error(f"Error generating quality recommendations: {str(e)}")
            return ["Unable to generate recommendations due to assessment error"]

    def _identify_quality_issues(self, quality_assessment: Dict[str, Any]) -> List[str]:
        """Identify specific quality issues."""
        try:
            issues = []

            if quality_assessment['completeness'] < 0.5:
                issues.append("Incomplete data: Missing critical onboarding information")

            if quality_assessment['freshness'] < 0.5:
                issues.append("Stale data: Information may be outdated")

            if quality_assessment['accuracy'] < 0.5:
                issues.append("Data accuracy concerns: Verify information validity")

            if quality_assessment['relevance'] < 0.5:
                issues.append("Low relevance: Data may not align with current needs")

            if quality_assessment['consistency'] < 0.5:
                issues.append("Inconsistent data: Conflicting information detected")

            return issues

        except Exception as e:
            logger.error(f"Error identifying quality issues: {str(e)}")
            return ["Unable to identify issues due to assessment error"]

    def validate_field_data(self, field_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate individual field data."""
        try:
            validation_result = {
                'is_valid': True,
                'errors': [],
                'warnings': [],
                'confidence': 1.0
            }

            for field_name, field_value in field_data.items():
                if field_value is None or field_value == '':
                    validation_result['errors'].append(f"Field '{field_name}' is empty")
                    validation_result['is_valid'] = False
                elif isinstance(field_value, str) and len(field_value.strip()) < 3:
                    validation_result['warnings'].append(f"Field '{field_name}' may be too short")
                    validation_result['confidence'] *= 0.9

            return validation_result

        except Exception as e:
            logger.error(f"Error validating field data: {str(e)}")
            return {
                'is_valid': False,
                'errors': ['Validation failed'],
                'warnings': [],
                'confidence': 0.0
            } 

def assess_data_quality(website_analysis: Dict, research_preferences: Dict, persona_data: Dict = None, competitor_analysis: List = None, gsc_analytics: Dict = None, bing_analytics: Dict = None) -> Dict[str, Any]:
    """Assess the quality and completeness of onboarding data."""
    try:
        quality_metrics = {
            'overall_score': 0.0,
            'completeness': 0.0,
            'freshness': 0.0,
            'relevance': 0.0,
            'confidence': 0.0
        }

        # Calculate completeness
        total_fields = 0
        filled_fields = 0

        # Website analysis completeness
        website_fields = ['domain', 'industry', 'business_type', 'target_audience', 'content_goals']
        for field in website_fields:
            total_fields += 1
            if website_analysis.get(field):
                filled_fields += 1

        # Research preferences completeness
        research_fields = ['research_topics', 'content_types', 'target_audience', 'industry_focus']
        for field in research_fields:
            total_fields += 1
            if research_preferences.get(field):
                filled_fields += 1

        # Persona data completeness
        total_fields += 1
        if persona_data and persona_data.get('core_persona'):
            filled_fields += 1

        # Competitor analysis completeness
        total_fields += 1
        if competitor_analysis and len(competitor_analysis) > 0:
            filled_fields += 1

        # GSC analytics completeness
        total_fields += 1
        if gsc_analytics and (gsc_analytics.get('data') or gsc_analytics.get('metrics')):
            filled_fields += 1

        # Bing analytics completeness
        total_fields += 1
        if bing_analytics and (bing_analytics.get('data') or bing_analytics.get('summary')):
            filled_fields += 1

        quality_metrics['completeness'] = filled_fields / total_fields if total_fields > 0 else 0.0

        # Calculate freshness
        freshness_scores = []
        for data_source in [website_analysis, research_preferences]:
            if data_source.get('data_freshness'):
                freshness_scores.append(data_source['data_freshness'])
        if persona_data and persona_data.get('data_freshness'):
            freshness_scores.append(persona_data['data_freshness'])
        if competitor_analysis:
            for competitor in competitor_analysis:
                if competitor.get('data_freshness'):
                    freshness_scores.append(competitor['data_freshness'])
                    break  # Just use first competitor's freshness
        if gsc_analytics and gsc_analytics.get('data_freshness'):
            freshness_scores.append(gsc_analytics['data_freshness'])
        if bing_analytics and bing_analytics.get('data_freshness'):
            freshness_scores.append(bing_analytics['data_freshness'])
        
        quality_metrics['freshness'] = sum(freshness_scores) / len(freshness_scores) if freshness_scores else 0.0

        # Calculate relevance (based on data presence and quality)
        relevance_score = 0.0
        if website_analysis.get('domain'):
            relevance_score += 0.20
        if research_preferences.get('research_topics'):
            relevance_score += 0.15
        if persona_data and persona_data.get('core_persona'):
            relevance_score += 0.15
        if competitor_analysis and len(competitor_analysis) > 0:
            relevance_score += 0.15
        if gsc_analytics and (gsc_analytics.get('data') or gsc_analytics.get('metrics')):
            relevance_score += 0.15  # Real analytics data is highly relevant
        if bing_analytics and (bing_analytics.get('data') or bing_analytics.get('summary')):
            relevance_score += 0.10  # Real analytics data is highly relevant
        
        quality_metrics['relevance'] = relevance_score

        # Calculate confidence
        quality_metrics['confidence'] = (quality_metrics['completeness'] + quality_metrics['freshness'] + quality_metrics['relevance']) / 3

        # Calculate overall score
        quality_metrics['overall_score'] = quality_metrics['confidence']

        return quality_metrics

    except Exception as e:
        logger.error(f"Error assessing data quality: {str(e)}")
        return {
            'overall_score': 0.0,
            'completeness': 0.0,
            'freshness': 0.0,
            'relevance': 0.0,
            'confidence': 0.0
        }
