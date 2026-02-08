# python-pipeline/topicModel.py
# RAG 기반 토픽 모델링
# 클라이언트 브리프를 바탕으로 유사 레퍼런스를 검색하고,
# LLM을 활용해 시각적/전략적 토픽을 추출하는 모듈

import openai
from supabase import create_client
import json
from collections import defaultdict

class RAGTopicModeler:
    def __init__(self):
        self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.openai = openai.Client(api_key=OPENAI_KEY)
    
    def extract_topics_from_brief(self, client_brief):
        """
        클라이언트 브리프 → RAG 검색 → LLM 토픽 추출
        """
        # Step 1: 브리프 임베딩
        brief_text = f"""
        Domain: {client_brief['domain']}
        Target: {client_brief['target']}
        Budget: {client_brief['budget']}
        Goal: {client_brief['goal']}
        """
        
        brief_embedding = self.openai.embeddings.create(
            model="text-embedding-3-small",
            input=brief_text
        ).data[0].embedding
        
        # Step 2: RAG 검색 (유사 레퍼런스)
        similar_refs = self.supabase.rpc(
            'search_similar_designs',
            {
                'query_embedding': brief_embedding,
                'match_threshold': 0.6,
                'match_count': 30,
                'filter_domain': client_brief['domain']
            }
        ).execute()
        
        # Step 3: 검색 결과로 컨텍스트 구성
        context_references = []
        for ref in similar_refs.data:
            full_ref = self.supabase.table('design_references')\
                .select('*')\
                .eq('id', ref['reference_id'])\
                .single()\
                .execute()
            context_references.append(full_ref.data)
        
        # Step 4: LLM으로 토픽 추출
        topics = self._llm_topic_extraction(
            brief=client_brief,
            similar_references=context_references
        )
        
        return topics
    
    def _llm_topic_extraction(self, brief, similar_references):
        """
        LLM에게 컨텍스트 기반 토픽 추출 요청
        """
        # 컨텍스트 요약
        context_summary = self._summarize_references(similar_references)
        
        prompt = f"""
You are a design strategist analyzing brand references.

# Client Brief:
- Domain: {brief['domain']}
- Target: {brief['target']}
- Budget: {brief['budget']}
- Goal: {brief['goal']}

# Similar References Found (Top 30):
{context_summary}

# Task:
Based on the similar references, extract:

1. **Visual Topics** (3-5 topics)
   - Dominant design patterns
   - Color/typography trends
   - Layout structures
   
2. **Strategic Topics** (3-5 topics)
   - Brand positioning patterns
   - UX approaches
   - Content strategies
   
3. **Emerging Trends** (2-3 trends)
   - What's gaining momentum
   - What's declining
   
4. **Recommendations** (3 specific)
   - Which references to prioritize
   - What to avoid
   - Unique opportunities

Return as JSON:
{{
  "visual_topics": [...],
  "strategic_topics": [...],
  "trends": [...],
  "recommendations": [...]
}}
"""
        
        response = self.openai.chat.completions.create(
            model="gpt-4o-2024-11-20",
            messages=[
                {"role": "system", "content": "You are a design intelligence analyst."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        topics = json.loads(response.choices[0].message.content)
        
        # Supabase에 저장
        self.supabase.table('topic_analysis').insert({
            'brief': brief,
            'topics': topics,
            'reference_count': len(similar_references),
            'created_at': 'now()'
        }).execute()
        
        return topics
    
    def _summarize_references(self, references):
        """
        30개 레퍼런스를 요약
        """
        summary_lines = []
        
        # 컨셉별 그룹핑
        by_concept = defaultdict(list)
        for ref in references:
            by_concept[ref['concept']].append(ref)
        
        for concept, refs in by_concept.items():
            count = len(refs)
            brands = [r.get('brand_name', 'Unknown') for r in refs[:3]]
            summary_lines.append(
                f"- {concept}: {count} references ({', '.join(brands)}...)"
            )
        
        # 톤앤매너 분포
        tones = [r['tone_manner'] for r in references]
        tone_counts = defaultdict(int)
        for tone in tones:
            tone_counts[tone] += 1
        
        summary_lines.append("\nTone Distribution:")
        for tone, count in sorted(tone_counts.items(), key=lambda x: -x[1])[:5]:
            summary_lines.append(f"- {tone}: {count}")
        
        return "\n".join(summary_lines)