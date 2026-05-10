// 바하마 낫소(Nassau) 도심 기반의 가상 도로망 데이터 (GeoAI Routing용)

// 노드(교차로) 좌표 정의
const nodes = {
    'A': [-77.345, 25.078], // 북쪽 해변가 (시작 위치)
    'B': [-77.340, 25.076],
    'C': [-77.343, 25.072],
    'D': [-77.336, 25.074],
    'E': [-77.338, 25.070],
    'F': [-77.330, 25.072],
    'G': [-77.346, 25.068],
    'H': [-77.332, 25.065], // 중앙 내륙 
    'I': [-77.325, 25.070],
    'J': [-77.325, 25.062]  // 남동쪽 고지대 대피소 (도착 위치)
};

// 엣지(도로) 연결 리스트: [출발노드, 도착노드]
const edges = [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'D'],
    ['B', 'C'],
    ['C', 'G'],
    ['C', 'E'],
    ['D', 'E'],
    ['D', 'F'],
    ['E', 'H'],
    ['F', 'I'],
    ['F', 'H'],
    ['G', 'H'],
    ['H', 'J'],
    ['I', 'J']
];

// 그래프 구축 함수 (A* 라우팅용)
// 거리를 가중치로 사용
function buildGraph(nodes, edges) {
    const graph = {};
    for (let key in nodes) {
        graph[key] = {};
    }
    
    // 유클리디안 거리(또는 turf distance) 계산
    edges.forEach(edge => {
        const u = edge[0];
        const v = edge[1];
        
        // 간단한 유클리디안 거리 계산 (어차피 좁은 지역이므로)
        const dx = nodes[u][0] - nodes[v][0];
        const dy = nodes[u][1] - nodes[v][1];
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // 양방향 통행
        graph[u][v] = { cost: dist, id: `${u}-${v}` };
        graph[v][u] = { cost: dist, id: `${u}-${v}` }; // 동일한 ID 공유하여 렌더링 시 매칭
    });
    
    return graph;
}

const networkGraph = buildGraph(nodes, edges);

// 시각화용 GeoJSON (모든 도로)
function getRoadGeoJSON(graph, blockedEdges = []) {
    const features = [];
    const added = new Set();
    
    for (let u in graph) {
        for (let v in graph[u]) {
            const edgeId = graph[u][v].id;
            if (!added.has(edgeId)) {
                added.add(edgeId);
                const isBlocked = blockedEdges.includes(edgeId);
                
                features.push({
                    type: "Feature",
                    properties: {
                        id: edgeId,
                        isBlocked: isBlocked ? 1 : 0 // 침수 여부
                    },
                    geometry: {
                        type: "LineString",
                        coordinates: [nodes[u], nodes[v]]
                    }
                });
            }
        }
    }
    
    return {
        type: "FeatureCollection",
        features: features
    };
}

// A* 알고리즘 (간이 구현)
function findShortestPath(graph, start, goal, blockedEdges = []) {
    const distances = {};
    const previous = {};
    const unvisited = new Set(Object.keys(graph));
    
    for (let node in graph) {
        distances[node] = Infinity;
    }
    distances[start] = 0;
    
    while (unvisited.size > 0) {
        // 가장 거리가 짧은 노드 찾기
        let curr = null;
        for (let node of unvisited) {
            if (curr === null || distances[node] < distances[curr]) {
                curr = node;
            }
        }
        
        if (distances[curr] === Infinity) break;
        if (curr === goal) break;
        
        unvisited.delete(curr);
        
        for (let neighbor in graph[curr]) {
            const edgeId = graph[curr][neighbor].id;
            // 차단된 도로는 비용 무한대
            const cost = blockedEdges.includes(edgeId) ? Infinity : graph[curr][neighbor].cost;
            
            const alt = distances[curr] + cost;
            if (alt < distances[neighbor]) {
                distances[neighbor] = alt;
                previous[neighbor] = curr;
            }
        }
    }
    
    // 경로 역추적
    const path = [];
    let u = goal;
    if (previous[u] !== undefined || u === start) {
        while (u !== undefined) {
            path.unshift(u);
            u = previous[u];
        }
    }
    
    // 경로 좌표 배열 반환
    const coords = path.map(node => nodes[node]);
    return coords;
}
