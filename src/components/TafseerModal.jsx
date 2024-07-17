import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "../style/Modal.css";

const TafseerModal = ({ show, onHide, verse }) => {
    const [selectedTafseer, setSelectedTafseer] = useState("");
    const [tafseerText, setTafseerText] = useState("");
    const tafseers = {
        1: "التفسير الميسر",
        2: "تفسير الجلالين",
        3: "تفسير السعدي",
        4: "تفسير ابن كثير",
        5: "تفسير الوسيط لطنطاوي",
        6: "تفسير البغوي",
        7: "تفسير القرطبي",
        8: "تفسير الطبري"
    };

    const fetchTafseer = async (tafseerId, surah, ayah) => {
        try {
            const response = await fetch(
                `/Quran/quran_tafseer/tafseer_${tafseerId}/surah_${surah}/tafseer_${tafseerId}_ayah_${ayah}.json`
            );
            const data = await response.json();
            setTafseerText(data.text);
        } catch (error) {
            console.error("Error fetching tafseer:", error);
            setTafseerText("Error fetching tafseer.");
        }
    };

    useEffect(() => {
        if (selectedTafseer) {
            const surah = verse.sura_no;
            const ayah = verse.aya_no;
            fetchTafseer(selectedTafseer, surah, ayah);
        }
    }, [selectedTafseer]);

    return (
        <Modal show={show} onHide={onHide} centered dialogClassName="custom-modal" dir="rtl">
            <Modal.Header closeButton></Modal.Header>
            <Modal.Body>
                <div className="quran-verse-modal">{verse.aya_text}</div>
                <Form.Group controlId="tafseerSelect" className="w-100">
                    <Form.Label>اختار التفسير</Form.Label>
                    <Form.Control
                        as="select"
                        value={selectedTafseer}
                        onChange={(e) => setSelectedTafseer(e.target.value)}
                        className="w-100"
                    >
                        <option value="" disabled>
                            اختار
                        </option>
                        {Object.entries(tafseers).map(([id, name]) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </Form.Control>
                </Form.Group>
                <div className="tafseer-text mt-3">
                    {tafseerText}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    اغلاق
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default TafseerModal;
