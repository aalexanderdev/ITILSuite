use chrono::Utc;
use serde_json::json;
use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::domain::agent::{
    GlpiAgentContent, GlpiAgentPayload, GlpiAgentResponse, GlpiBios, GlpiCpu, GlpiDrive,
    GlpiHardware, GlpiMemory, GlpiMonitor, GlpiNetwork, GlpiOs, GlpiSoftware,
};
use crate::error::AppError;

pub struct AgentService;

impl AgentService {
    pub async fn process_agent_payload(
        pool: &PgPool,
        default_entity_id: Uuid,
        payload: GlpiAgentPayload,
    ) -> Result<GlpiAgentResponse, AppError> {
        let content = payload.content.unwrap_or(GlpiAgentContent {
            hardware: None,
            bios: None,
            operatingsystem: None,
            cpus: None,
            memories: None,
            drives: None,
            networks: None,
            monitors: None,
            softwares: None,
            versionclient: None,
        });

        let uuid_opt = content.hardware.as_ref().and_then(|h| h.uuid.clone());
        let serial_opt = content.bios.as_ref().and_then(|b| b.ssn.clone());
        let hostname_opt = content.hardware.as_ref().and_then(|h| h.name.clone());
        let manufacturer_opt = content.bios.as_ref().and_then(|b| b.smanufacturer.clone());
        let model_opt = content.bios.as_ref().and_then(|b| b.smodel.clone());
        let agent_version = content
            .versionclient
            .clone()
            .unwrap_or_else(|| "GLPI-Agent_v1.11".to_string());

        // Normalize hardware manufacturer & model via Dictionary Engine
        let norm_manufacturer = if let Some(ref m) = manufacturer_opt {
            Some(crate::services::rules::dictionaries::DictionaryService::normalize_manufacturer(pool, m).await)
        } else {
            None
        };

        let norm_model = if let Some(ref m) = model_opt {
            Some(crate::services::rules::dictionaries::DictionaryService::normalize_model(pool, "computer", m).await)
        } else {
            None
        };

        // Extract primary network details for entity evaluation
        let primary_ip = content
            .networks
            .as_ref()
            .and_then(|nets| nets.iter().find_map(|n| n.ipaddress.clone()));
        let primary_mac = content
            .networks
            .as_ref()
            .and_then(|nets| nets.iter().find_map(|n| n.mac.clone()));

        // Entity assignment rule for equipment (IP/subnet/tag/hostname)
        let target_entity_id = crate::services::rules::assets::AssetRulesService::evaluate_asset_entity(
            pool,
            primary_ip.as_deref(),
            None,
            hostname_opt.as_deref(),
            None,
        )
        .await
        .unwrap_or(default_entity_id);

        // Equipment import & link reconciliation rules
        let recon_decision = crate::services::rules::assets::AssetRulesService::evaluate_reconciliation_decision(
            pool,
            target_entity_id,
            uuid_opt.as_deref(),
            serial_opt.as_deref(),
            primary_mac.as_deref(),
            hostname_opt.as_deref(),
        )
        .await;

        if recon_decision == "reject" {
            info!("Equipment reconciliation rule REJECTED asset import for host: {:?}", hostname_opt);
            return Ok(GlpiAgentResponse {
                status: "rejected".to_string(),
                message: "El equipo fue rechazado por una regla de reconciliación de inventario".to_string(),
                asset_id: Uuid::nil(),
                action_taken: "rejected_by_rule".to_string(),
                asset_name: hostname_opt.unwrap_or_else(|| "Unknown".into()),
            });
        }

        // Construct Serde JSON specifications from GLPI-Agent payload
        let mut specs = json!({});

        if let Some(ref os) = content.operatingsystem {
            let (norm_os, norm_ver, norm_arch) = crate::services::rules::dictionaries::DictionaryService::normalize_os(
                pool,
                os.name.as_deref().unwrap_or(""),
                os.version.as_deref().unwrap_or(""),
                os.arch.as_deref().unwrap_or(""),
            ).await;

            specs["os"] = json!({
                "name": norm_os,
                "version": norm_ver,
                "arch": norm_arch,
                "kernel": os.kernel_version,
                "install_date": os.install_date
            });
        }

        if let Some(ref cpus) = content.cpus {
            if let Some(cpu) = cpus.first() {
                specs["cpu"] = json!({
                    "name": cpu.name,
                    "speed_mhz": cpu.speed,
                    "cores": cpu.cores,
                    "threads": cpu.threads
                });
            }
        }

        if let Some(ref memories) = content.memories {
            let total_capacity: i64 = memories.iter().filter_map(|m| m.capacity).sum();
            let first_type = memories.iter().find_map(|m| m.memory_type.clone());
            specs["memory"] = json!({
                "total_mb": total_capacity,
                "type": first_type.unwrap_or_else(|| "RAM".to_string()),
                "slots_used": memories.len()
            });
        }

        if let Some(ref drives) = content.drives {
            let storage_list: Vec<serde_json::Value> = drives
                .iter()
                .map(|d| {
                    json!({
                        "name": d.volumn.clone().unwrap_or_else(|| "Storage".into()),
                        "size_gb": d.total.unwrap_or(0) / 1024,
                        "free_gb": d.free.unwrap_or(0) / 1024,
                        "filesystem": d.filesystem,
                        "drive_type": d.drive_type
                    })
                })
                .collect();
            specs["storage"] = json!(storage_list);
        }

        if let Some(ref networks) = content.networks {
            let net_list: Vec<serde_json::Value> = networks
                .iter()
                .map(|n| {
                    json!({
                        "name": n.description.clone().unwrap_or_else(|| "Interface".into()),
                        "mac": n.mac,
                        "ip": n.ipaddress,
                        "netmask": n.ipmask,
                        "status": n.status.clone().unwrap_or_else(|| "up".into()),
                        "speed": n.speed
                    })
                })
                .collect();
            specs["networks"] = json!(net_list);
        }

        if let Some(ref softwares) = content.softwares {
            let mut sw_list = Vec::new();
            for s in softwares {
                let sw_name = s.name.clone().unwrap_or_default();
                let norm_sw = if !sw_name.is_empty() {
                    crate::services::rules::dictionaries::DictionaryService::normalize_software(pool, &sw_name).await
                } else {
                    sw_name
                };
                sw_list.push(json!({
                    "name": norm_sw,
                    "version": s.version,
                    "publisher": s.publisher
                }));
            }
            specs["softwares"] = json!(sw_list);
        }

        // GLPI Reconciliation Algorithm:
        // Priority 1: BIOS / Hardware UUID
        let mut matched_asset_id: Option<(Uuid, serde_json::Value, String)> = None;

        if let Some(ref u) = uuid_opt {
            let row: Option<(Uuid, serde_json::Value, String)> = sqlx::query_as(
                "SELECT id, locked_fields, name FROM assets WHERE uuid = $1"
            )
            .bind(u)
            .fetch_optional(pool)
            .await?;
            if let Some(r) = row {
                matched_asset_id = Some(r);
            }
        }

        // Priority 2: Serial Number (SSN)
        if matched_asset_id.is_none() {
            if let Some(ref s) = serial_opt {
                let row: Option<(Uuid, serde_json::Value, String)> = sqlx::query_as(
                    "SELECT id, locked_fields, name FROM assets WHERE serial_number = $1"
                )
                .bind(s)
                .fetch_optional(pool)
                .await?;
                if let Some(r) = row {
                    matched_asset_id = Some(r);
                }
            }
        }

        // Priority 3: MAC Address match in networks specification
        if matched_asset_id.is_none() {
            if let Some(ref networks) = content.networks {
                for net in networks {
                    if let Some(ref mac) = net.mac {
                        if !mac.is_empty() {
                            let row: Option<(Uuid, serde_json::Value, String)> = sqlx::query_as(
                                "SELECT id, locked_fields, name FROM assets
                                 WHERE specifications->'networks' @> jsonb_build_array(jsonb_build_object('mac', $1::text))"
                            )
                            .bind(mac)
                            .fetch_optional(pool)
                            .await?;
                            if let Some(r) = row {
                                matched_asset_id = Some(r);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Priority 4: Hostname in target entity
        if matched_asset_id.is_none() {
            if let Some(ref h) = hostname_opt {
                let row: Option<(Uuid, serde_json::Value, String)> = sqlx::query_as(
                    "SELECT id, locked_fields, name FROM assets
                     WHERE LOWER(name) = LOWER($1) AND entity_id = $2"
                )
                .bind(h)
                .bind(target_entity_id)
                .fetch_optional(pool)
                .await?;
                if let Some(r) = row {
                    matched_asset_id = Some(r);
                }
            }
        }

        let (asset_id, action_taken, final_name) = match matched_asset_id {
            Some((id, locked_fields_val, current_name)) => {
                let locked_fields: Vec<String> = serde_json::from_value(locked_fields_val)
                    .unwrap_or_default();

                info!("GLPI-Agent reconciled existing asset ID: {} ({})", id, current_name);

                let should_update_name = !locked_fields.contains(&"name".to_string()) && hostname_opt.is_some();
                let new_name = if should_update_name {
                    hostname_opt.as_deref().unwrap_or(&current_name)
                } else {
                    &current_name
                };

                let should_update_manuf = !locked_fields.contains(&"manufacturer".to_string()) && norm_manufacturer.is_some();
                let should_update_model = !locked_fields.contains(&"model".to_string()) && norm_model.is_some();
                let should_update_serial = !locked_fields.contains(&"serial_number".to_string()) && serial_opt.is_some();
                let should_update_uuid = !locked_fields.contains(&"uuid".to_string()) && uuid_opt.is_some();

                sqlx::query(
                    "UPDATE assets SET
                        name = CASE WHEN $1 THEN $2 ELSE name END,
                        manufacturer = CASE WHEN $3 THEN $4 ELSE manufacturer END,
                        model = CASE WHEN $5 THEN $6 ELSE model END,
                        serial_number = CASE WHEN $7 THEN $8 ELSE serial_number END,
                        uuid = CASE WHEN $9 THEN $10 ELSE uuid END,
                        last_inventory_at = $11,
                        agent_version = $12,
                        specifications = $13,
                        updated_at = $11
                     WHERE id = $14"
                )
                .bind(should_update_name)
                .bind(new_name)
                .bind(should_update_manuf)
                .bind(norm_manufacturer.as_deref())
                .bind(should_update_model)
                .bind(norm_model.as_deref())
                .bind(should_update_serial)
                .bind(serial_opt.as_deref())
                .bind(should_update_uuid)
                .bind(uuid_opt.as_deref())
                .bind(Utc::now())
                .bind(&agent_version)
                .bind(&specs)
                .bind(id)
                .execute(pool)
                .await?;

                (id, "reconciled_updated".to_string(), new_name.to_string())
            }
            None => {
                let new_id = Uuid::new_v4();
                let name = hostname_opt.unwrap_or_else(|| format!("PC-{}", &new_id.to_string()[..8]));
                let lower_name = name.to_lowercase();
                let asset_type = if lower_name.contains("srv") || lower_name.contains("server") {
                    "server"
                } else {
                    "computer"
                };
                let asset_status = if recon_decision == "trash" { "trash" } else { "active" };

                info!("GLPI-Agent registering NEW asset ID: {} ({}) with status {}", new_id, name, asset_status);

                sqlx::query(
                    "INSERT INTO assets (
                        id, entity_id, name, asset_type, status, serial_number, uuid,
                        manufacturer, model, last_inventory_at, agent_version, specifications
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                    )"
                )
                .bind(new_id)
                .bind(target_entity_id)
                .bind(&name)
                .bind(asset_type)
                .bind(asset_status)
                .bind(serial_opt.as_deref())
                .bind(uuid_opt.as_deref())
                .bind(norm_manufacturer.as_deref())
                .bind(norm_model.as_deref())
                .bind(Utc::now())
                .bind(&agent_version)
                .bind(&specs)
                .execute(pool)
                .await?;

                (new_id, "created".to_string(), name)
            }
        };

        // Reconcile connected monitors if present in agent payload
        if let Some(ref monitors) = content.monitors {
            for m in monitors {
                if let Some(ref mon_name) = m.name {
                    let mon_serial = m.serial.clone();
                    let mon_id = Uuid::new_v4();

                    let existing_mon: Option<(Uuid,)> = if let Some(ref s) = mon_serial {
                        sqlx::query_as("SELECT id FROM assets WHERE serial_number = $1 AND asset_type = 'monitor'")
                            .bind(s)
                            .fetch_optional(pool)
                            .await?
                    } else {
                        sqlx::query_as("SELECT id FROM assets WHERE name = $1 AND entity_id = $2 AND asset_type = 'monitor'")
                            .bind(mon_name)
                            .bind(default_entity_id)
                            .fetch_optional(pool)
                            .await?
                    };

                    let final_mon_id = match existing_mon {
                        Some((eid,)) => {
                            sqlx::query(
                                "UPDATE assets SET
                                    last_inventory_at = $1,
                                    agent_version = $2,
                                    updated_at = $1
                                 WHERE id = $3"
                            )
                            .bind(Utc::now())
                            .bind(&agent_version)
                            .bind(eid)
                            .execute(pool)
                            .await?;
                            eid
                        }
                        None => {
                            let mon_specs = json!({
                                "caption": m.caption,
                                "resolution": m.resolution
                            });

                            sqlx::query(
                                "INSERT INTO assets (
                                    id, entity_id, name, asset_type, status, serial_number,
                                    manufacturer, last_inventory_at, agent_version, specifications
                                ) VALUES (
                                    $1, $2, $3, 'monitor', 'active', $4, $5, $6, $7, $8
                                )"
                            )
                            .bind(mon_id)
                            .bind(default_entity_id)
                            .bind(mon_name)
                            .bind(mon_serial.as_deref())
                            .bind(m.manufacturer.as_deref())
                            .bind(Utc::now())
                            .bind(&agent_version)
                            .bind(mon_specs)
                            .execute(pool)
                            .await?;
                            mon_id
                        }
                    };

                    // Link computer <-> monitor in asset_connections
                    sqlx::query(
                        "INSERT INTO asset_connections (computer_id, connected_asset_id, connection_type)
                         VALUES ($1, $2, 'video')
                         ON CONFLICT (computer_id, connected_asset_id) DO NOTHING"
                    )
                    .bind(asset_id)
                    .bind(final_mon_id)
                    .execute(pool)
                    .await?;
                }
            }
        }

        Ok(GlpiAgentResponse {
            status: "ok".to_string(),
            message: format!("Asset '{}' successfully processed via GLPI-Agent protocol", final_name),
            asset_id,
            action_taken,
            asset_name: final_name,
        })
    }

    pub fn get_preset_payload(preset_name: &str) -> GlpiAgentPayload {
        match preset_name {
            "thinkpad_laptop" => GlpiAgentPayload {
                deviceid: Some("thinkpad-t14s-gen4-2026-09-18".into()),
                action: Some("inventory".into()),
                itemtype: Some("Computer".into()),
                content: Some(GlpiAgentContent {
                    hardware: Some(GlpiHardware {
                        name: Some("NB-STOCK-04".into()),
                        workgroup: Some("CORP-DOMAIN".into()),
                        uuid: Some("23187210-9182-4112-9811-pf48x91a0001".into()),
                        dns: Some("192.168.10.155".into()),
                        vmsystem: Some("Physical".into()),
                        memory: Some(32768),
                        swap: Some(8192),
                    }),
                    bios: Some(GlpiBios {
                        smanufacturer: Some("Lenovo".into()),
                        smodel: Some("ThinkPad T14s Gen 4".into()),
                        ssn: Some("PF48X91A".into()),
                        bversion: Some("N3YET58W (1.28 )".into()),
                        bdate: Some("2024-05-10".into()),
                    }),
                    operatingsystem: Some(GlpiOs {
                        name: Some("Microsoft Windows 11 Pro".into()),
                        version: Some("23H2".into()),
                        arch: Some("x86_64".into()),
                        kernel_version: Some("10.0.22631.4169".into()),
                        install_date: Some("2025-11-20 10:14:22".into()),
                    }),
                    cpus: Some(vec![GlpiCpu {
                        name: Some("AMD Ryzen 7 PRO 7840U w/ Radeon 780M Graphics".into()),
                        speed: Some(3300),
                        cores: Some(8),
                        threads: Some(16),
                    }]),
                    memories: Some(vec![GlpiMemory {
                        capacity: Some(32768),
                        memory_type: Some("LPDDR5x".into()),
                        speed: Some(6400),
                        numslots: Some(1),
                    }]),
                    drives: Some(vec![GlpiDrive {
                        volumn: Some("C:".into()),
                        filesystem: Some("NTFS".into()),
                        total: Some(524288),
                        free: Some(450560),
                        drive_type: Some("NVMe SSD".into()),
                    }]),
                    networks: Some(vec![GlpiNetwork {
                        description: Some("Intel Wi-Fi 6E AX211 160MHz".into()),
                        mac: Some("e4:54:e8:1b:22:90".into()),
                        ipaddress: Some("192.168.10.155".into()),
                        ipmask: Some("255.255.255.0".into()),
                        status: Some("up".into()),
                        speed: Some("Wi-Fi 6E".into()),
                        network_type: Some("Wireless".into()),
                    }]),
                    monitors: None,
                    softwares: Some(vec![
                        GlpiSoftware {
                            name: Some("Microsoft Office 365 ProPlus".into()),
                            version: Some("16.0.17928.20114".into()),
                            publisher: Some("Microsoft Corporation".into()),
                        },
                        GlpiSoftware {
                            name: Some("Google Chrome".into()),
                            version: Some("128.0.6613.120".into()),
                            publisher: Some("Google LLC".into()),
                        },
                    ]),
                    versionclient: Some("GLPI-Agent_v1.11".into()),
                }),
            },
            "new_macbook" => GlpiAgentPayload {
                deviceid: Some("macbook-pro-m3max-2026-09-18".into()),
                action: Some("inventory".into()),
                itemtype: Some("Computer".into()),
                content: Some(GlpiAgentContent {
                    hardware: Some(GlpiHardware {
                        name: Some("MBP16-DESIGN-01".into()),
                        workgroup: Some("DESIGN-STUDIO".into()),
                        uuid: Some("e71092a4-56b0-410a-85d1-c02g4001md6r".into()),
                        dns: Some("192.168.20.88".into()),
                        vmsystem: Some("Physical".into()),
                        memory: Some(65536),
                        swap: Some(16384),
                    }),
                    bios: Some(GlpiBios {
                        smanufacturer: Some("Apple Inc.".into()),
                        smodel: Some("MacBook Pro 16-inch (Nov 2023)".into()),
                        ssn: Some("C02G4001MD6R".into()),
                        bversion: Some("10151.101.3".into()),
                        bdate: Some("2024-03-01".into()),
                    }),
                    operatingsystem: Some(GlpiOs {
                        name: Some("macOS Sonoma".into()),
                        version: Some("14.6.1".into()),
                        arch: Some("arm64".into()),
                        kernel_version: Some("Darwin 23.6.0".into()),
                        install_date: Some("2026-02-12 11:00:00".into()),
                    }),
                    cpus: Some(vec![GlpiCpu {
                        name: Some("Apple M3 Max (16 cores)".into()),
                        speed: Some(4050),
                        cores: Some(16),
                        threads: Some(16),
                    }]),
                    memories: Some(vec![GlpiMemory {
                        capacity: Some(65536),
                        memory_type: Some("Unified Memory".into()),
                        speed: Some(6400),
                        numslots: Some(1),
                    }]),
                    drives: Some(vec![GlpiDrive {
                        volumn: Some("/System/Volumes/Data".into()),
                        filesystem: Some("APFS".into()),
                        total: Some(2097152),
                        free: Some(1572864),
                        drive_type: Some("Apple NVMe SSD".into()),
                    }]),
                    networks: Some(vec![GlpiNetwork {
                        description: Some("en0 (Wi-Fi 6E)".into()),
                        mac: Some("f0:18:98:44:b1:2c".into()),
                        ipaddress: Some("192.168.20.88".into()),
                        ipmask: Some("255.255.255.0".into()),
                        status: Some("up".into()),
                        speed: Some("Wi-Fi 6E".into()),
                        network_type: Some("Wireless".into()),
                    }]),
                    monitors: Some(vec![GlpiMonitor {
                        name: Some("Apple Studio Display 27\" 5K".into()),
                        serial: Some("F6KG8931MD90".into()),
                        manufacturer: Some("Apple Inc.".into()),
                        caption: Some("5K Retina Display with True Tone".into()),
                        resolution: Some("5120x2880".into()),
                    }]),
                    softwares: Some(vec![
                        GlpiSoftware {
                            name: Some("Figma Desktop".into()),
                            version: Some("116.15.4".into()),
                            publisher: Some("Figma Inc.".into()),
                        },
                        GlpiSoftware {
                            name: Some("Adobe Photoshop 2026".into()),
                            version: Some("25.11".into()),
                            publisher: Some("Adobe Systems".into()),
                        },
                    ]),
                    versionclient: Some("GLPI-Agent_v1.11".into()),
                }),
            },
            _ => GlpiAgentPayload {
                deviceid: Some("ws-dev-juan-reconcile".into()),
                action: Some("inventory".into()),
                itemtype: Some("Computer".into()),
                content: Some(GlpiAgentContent {
                    hardware: Some(GlpiHardware {
                        name: Some("WS-DEV-JUAN".into()),
                        workgroup: Some("DEVELOPERS".into()),
                        uuid: Some("4c4c4544-0048-4710-8039-b2c04f353537".into()),
                        dns: Some("192.168.10.142".into()),
                        vmsystem: Some("Physical".into()),
                        memory: Some(32768),
                        swap: Some(8192),
                    }),
                    bios: Some(GlpiBios {
                        smanufacturer: Some("Dell Inc.".into()),
                        smodel: Some("Precision 5570".into()),
                        ssn: Some("8HG9TK3".into()),
                        bversion: Some("1.18.0".into()),
                        bdate: Some("2024-04-15".into()),
                    }),
                    operatingsystem: Some(GlpiOs {
                        name: Some("Ubuntu 24.04.1 LTS".into()),
                        version: Some("24.04".into()),
                        arch: Some("x86_64".into()),
                        kernel_version: Some("6.8.0-45-generic".into()),
                        install_date: Some("2026-01-10 09:30:00".into()),
                    }),
                    cpus: Some(vec![GlpiCpu {
                        name: Some("12th Gen Intel(R) Core(TM) i7-12800H".into()),
                        speed: Some(2400),
                        cores: Some(14),
                        threads: Some(20),
                    }]),
                    memories: Some(vec![GlpiMemory {
                        capacity: Some(32768),
                        memory_type: Some("DDR5".into()),
                        speed: Some(4800),
                        numslots: Some(2),
                    }]),
                    drives: Some(vec![GlpiDrive {
                        volumn: Some("/".into()),
                        filesystem: Some("ext4".into()),
                        total: Some(1048576),
                        free: Some(496640),
                        drive_type: Some("NVMe PC801 SK hynix".into()),
                    }]),
                    networks: Some(vec![GlpiNetwork {
                        description: Some("wlp0s20f3".into()),
                        mac: Some("38:68:dd:94:a1:b2".into()),
                        ipaddress: Some("192.168.10.142".into()),
                        ipmask: Some("255.255.255.0".into()),
                        status: Some("up".into()),
                        speed: Some("Wi-Fi 6E".into()),
                        network_type: Some("Wireless".into()),
                    }]),
                    monitors: Some(vec![GlpiMonitor {
                        name: Some("MON-DELL-U2723QE".into()),
                        serial: Some("CN-0M381P-74261".into()),
                        manufacturer: Some("Dell Inc.".into()),
                        caption: Some("UltraSharp 27 4K USB-C Hub Monitor".into()),
                        resolution: Some("3840x2160".into()),
                    }]),
                    softwares: Some(vec![
                        GlpiSoftware {
                            name: Some("Docker Engine".into()),
                            version: Some("27.2.0".into()),
                            publisher: Some("Docker Inc.".into()),
                        },
                        GlpiSoftware {
                            name: Some("Rust Toolchain".into()),
                            version: Some("1.80.1".into()),
                            publisher: Some("Rust Foundation".into()),
                        },
                    ]),
                    versionclient: Some("GLPI-Agent_v1.11".into()),
                }),
            },
        }
    }
}
