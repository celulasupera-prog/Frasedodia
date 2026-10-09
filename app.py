import streamlit as st
import json
import os
import random
import time
from datetime import datetime, timedelta

DATA_FILE = "dados.json"

# --- Inicialização / Load ---
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "participants": [
            {"id": "p_1", "name": "Ana Silva", "active": True},
            {"id": "p_2", "name": "Bruno Santos", "active": True},
            {"id": "p_3", "name": "Carla Lima", "active": True}
        ],
        "cycleNumber": 1,
        "drawnParticipantIds": [],
        "history": []
    }

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

if "app_data" not in st.session_state:
    st.session_state.app_data = load_data()

data = st.session_state.app_data

st.set_page_config(page_title="Frase do Dia", page_icon="✨", layout="centered")

st.title("✨ Sorteio: Frase do Dia")

# --- Tabs ---
tab_draw, tab_participants, tab_history = st.tabs(["🎯 Sorteio", "👥 Participantes", "📜 Histórico"])

with tab_participants:
    st.header("Gerenciar Participantes")
    
    col1, col2 = st.columns([3, 1])
    with col1:
        new_name = st.text_input("Nome do participante")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("Adicionar"):
            if new_name.strip():
                new_id = f"p_{int(time.time())}"
                data["participants"].append({"id": new_id, "name": new_name.strip(), "active": True})
                save_data(data)
                st.success(f"{new_name} adicionado!")
                st.rerun()
    
    st.divider()
    
    if data["participants"]:
        for p in data["participants"]:
            c1, c2, c3 = st.columns([3, 1, 1])
            c1.write(p["name"])
            
            # Checkbox status (Ativo/Inativo)
            is_active = c2.checkbox("Ativo", value=p["active"], key=f"active_{p['id']}")
            if is_active != p["active"]:
                p["active"] = is_active
                save_data(data)
                st.rerun()
                
            if c3.button("Remover", key=f"del_{p['id']}"):
                data["participants"] = [x for x in data["participants"] if x["id"] != p["id"]]
                data["drawnParticipantIds"] = [x for x in data["drawnParticipantIds"] if x != p["id"]]
                save_data(data)
                st.rerun()
    else:
        st.info("Nenhum participante cadastrado.")

with tab_history:
    st.header("Histórico de Sorteios")
    
    if st.button("Limpar Histórico e Resetar Ciclos", type="primary"):
        data["history"] = []
        data["cycleNumber"] = 1
        data["drawnParticipantIds"] = []
        save_data(data)
        st.success("Histórico apagado com sucesso!")
        st.rerun()
        
    st.divider()
    
    if data["history"]:
        for h in data["history"]:
            with st.expander(f"{h['date'][:10]} - {h['participantName']} (Ciclo {h['cycleNumber']})"):
                phrase = st.text_area("Frase do Dia", value=h.get("phrase", ""), key=f"phrase_{h['id']}")
                if st.button("Salvar Frase", key=f"save_{h['id']}"):
                    h["phrase"] = phrase
                    save_data(data)
                    st.success("Frase salva!")
                
                if st.button("Excluir Sorteio", key=f"del_h_{h['id']}"):
                    data["history"] = [x for x in data["history"] if x["id"] != h["id"]]
                    save_data(data)
                    st.rerun()
    else:
        st.info("O histórico está vazio.")


with tab_draw:
    active_participants = [p for p in data["participants"] if p["active"]]
    drawn_ids = data["drawnParticipantIds"]
    remaining = [p for p in active_participants if p["id"] not in drawn_ids]
    
    st.subheader(f"Ciclo Atual: {data['cycleNumber']}")
    
    st.progress(len(drawn_ids) / max(len(active_participants), 1))
    st.write(f"Sorteados: {len(drawn_ids)} / {len(active_participants)}")
    
    st.write("---")
    
    if not active_participants:
        st.warning("Cadastre participantes ativos para começar.")
    else:
        if st.button("SORTEAR PESSOA", type="primary", use_container_width=True):
            
            # Se não há mais restantes, reseta o ciclo
            if not remaining:
                data["cycleNumber"] += 1
                data["drawnParticipantIds"] = []
                remaining = active_participants
                st.toast(f"Novo ciclo iniciado: {data['cycleNumber']}")
            
            winner = random.choice(remaining)
            
            # Animação de suspense
            placeholder = st.empty()
            
            # Toca audio de sucesso
            st.audio("success.mp3", format="audio/mpeg", autoplay=True)
            
            # Efeito de roleta rápida
            for i in range(25):
                temp_name = random.choice(active_participants)["name"]
                placeholder.markdown(f"<h1 style='text-align: center; color: gray;'>{temp_name}</h1>", unsafe_allow_html=True)
                time.sleep(0.05 + (i * 0.005)) # Vai desacelerando
                
            # Exibe Vencedor
            placeholder.markdown(f"<h1 style='text-align: center; color: #10b981;'>✨ {winner['name']} ✨</h1>", unsafe_allow_html=True)
            st.balloons()
            
            # Calcula próxima data válida (pula fds)
            next_day = datetime.now() + timedelta(days=1)
            while next_day.weekday() >= 5: # 5=Sat, 6=Sun
                next_day += timedelta(days=1)
                
            # Salva no estado
            data["drawnParticipantIds"].append(winner["id"])
            draw_record = {
                "id": f"draw_{int(time.time())}",
                "date": next_day.isoformat(),
                "participantId": winner["id"],
                "participantName": winner["name"],
                "phrase": "",
                "cycleNumber": data["cycleNumber"]
            }
            data["history"].insert(0, draw_record)
            save_data(data)
            
            st.success(f"{winner['name']} foi sorteado(a) para a frase do próximo dia!")
